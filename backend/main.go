package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DB instance
var DB *gorm.DB

// User Model المحدث ليتوافق مع الحقول الإضافية (يوتيوبر ومستثمر)
type User struct {
	ID             uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	FullName       string         `json:"fullName"`
	Email          string         `json:"email" gorm:"unique;index"`
	Password       string         `json:"-"`
	Role           string         `json:"role"`
	Avatar         string         `json:"avatar"`
	Bio            string         `json:"bio"`
	Location       string         `json:"location"`
	Website        string         `json:"website"`
	TargetIndustry string         `json:"targetIndustry"`
	YoutubeUrl     string         `json:"youtubeUrl"`     // مخصص لليوتيوبر
	PyCardId       string         `json:"pyCardId"`       // مخصص للمستثمر
	ProjectProof   string         `json:"projectProof"`   // مسار ملف إثبات المشروع (PDF) للمستثمر
	Skills         []string       `json:"skills" gorm:"serializer:json"`
	FocusAreas     []string       `json:"focusAreas" gorm:"serializer:json"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

type SignalMessage struct {
	Type            string      `json:"type"`
	TargetUserID    string      `json:"targetUserId,omitempty"`
	CallID          string      `json:"callId,omitempty"`
	CallerName      string      `json:"callerName,omitempty"`
	CallerRole      string      `json:"callerRole,omitempty"`
	CallerAvatarUrl string      `json:"callerAvatarUrl,omitempty"`
	Note            string      `json:"note,omitempty"`
	Offer           interface{} `json:"offer,omitempty"`
	Answer          interface{} `json:"answer,omitempty"`
	Candidate       interface{} `json:"candidate,omitempty"`
	RoomID          string      `json:"roomId,omitempty"`
	PeerID          string      `json:"peerId,omitempty"`
}

type Client struct {
	ID           string          `json:"id"`
	UserID       string          `json:"userId"`
	FullName     string          `json:"fullName"`
	Avatar       string          `json:"avatar"`
	Conn         *websocket.Conn `json:"-"`
	UserRole     string          `json:"userRole"`
	TargetFilter string          `json:"targetFilter"`
	Peer         *Client         `json:"-"`
	RoomID       string          `json:"roomId,omitempty"`
	sendChan     chan []byte     `json:"-"`
	isClosed     bool
	mu           sync.Mutex
}

func (c *Client) SafeWrite(msg []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.isClosed || c.sendChan == nil {
		return
	}
	select {
	case c.sendChan <- msg:
	default:
		log.Printf("Send buffer full for client %s, dropping message", c.ID)
	}
}

func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.isClosed {
		c.isClosed = true
		close(c.sendChan)
	}
}

type CallRequest struct {
	ID           string
	Caller       *Client
	TargetUserID string
}

type Hub struct {
	youtuberQueue []*Client
	investorQueue []*Client
	allQueue      []*Client
	clients       map[string]*Client
	rooms         map[string]map[string]*Client
	pendingCalls  map[string]*CallRequest
	mu            sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		youtuberQueue: make([]*Client, 0),
		investorQueue: make([]*Client, 0),
		allQueue:      make([]*Client, 0),
		clients:       make(map[string]*Client),
		rooms:         make(map[string]map[string]*Client),
		pendingCalls:  make(map[string]*CallRequest),
	}
}

func (h *Hub) BroadcastOnlineCount() {
	count := len(h.clients)
	msg, _ := json.Marshal(map[string]interface{}{
		"type":  "online_count",
		"count": count,
	})

	for _, client := range h.clients {
		client.SafeWrite(msg)
	}
}

func (h *Hub) RegisterClient(client *Client) {
	h.mu.Lock()
	h.clients[client.ID] = client
	log.Printf("Client registered: %s (%s, UserID: %s)", client.ID, client.FullName, client.UserID)
	h.BroadcastOnlineCount()
	h.mu.Unlock()
}

func (h *Hub) HandleSendCallRequest(caller *Client, sig SignalMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()

	targetUserID := sig.TargetUserID
	callID := uuid.New().String()

	var targetClient *Client
	for _, c := range h.clients {
		if c.UserID == targetUserID {
			targetClient = c
			break
		}
	}

	if targetClient == nil {
		resp, _ := json.Marshal(map[string]interface{}{
			"type":    "call_declined",
			"message": "User is currently offline.",
		})
		caller.SafeWrite(resp)
		return
	}

	h.pendingCalls[callID] = &CallRequest{
		ID:           callID,
		Caller:       caller,
		TargetUserID: targetUserID,
	}

	reqMsg, _ := json.Marshal(map[string]interface{}{
		"type":            "incoming_call_request",
		"callId":          callID,
		"callerId":        caller.ID,
		"callerName":      sig.CallerName,
		"callerRole":      sig.CallerRole,
		"callerAvatarUrl": sig.CallerAvatarUrl,
		"note":            sig.Note,
	})
	targetClient.SafeWrite(reqMsg)
}

func (h *Hub) HandleAcceptCallRequest(receiver *Client, sig SignalMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()

	callID := sig.CallID
	callReq, exists := h.pendingCalls[callID]
	if !exists {
		return
	}

	delete(h.pendingCalls, callID)

	msgCaller, _ := json.Marshal(map[string]interface{}{
		"type":     "call_accepted",
		"callId":   callID,
		"peerId":   receiver.ID,
		"peerName": receiver.FullName,
	})
	callReq.Caller.SafeWrite(msgCaller)
}

func (h *Hub) HandleDeclineCallRequest(receiver *Client, sig SignalMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()

	callID := sig.CallID
	callReq, exists := h.pendingCalls[callID]
	if !exists {
		return
	}

	delete(h.pendingCalls, callID)

	msgCaller, _ := json.Marshal(map[string]interface{}{
		"type":    "call_declined",
		"callId":  callID,
		"message": "Call was declined.",
	})
	callReq.Caller.SafeWrite(msgCaller)
}

func (h *Hub) HandleInitDirectCall(client *Client, sig SignalMessage) {
	h.mu.Lock()
	defer h.mu.Unlock()

	roomID := sig.RoomID
	if roomID == "" {
		return
	}

	client.RoomID = roomID

	if _, exists := h.rooms[roomID]; !exists {
		h.rooms[roomID] = make(map[string]*Client)
	}

	h.rooms[roomID][client.ID] = client

	if len(h.rooms[roomID]) == 2 {
		var peer *Client
		for id, c := range h.rooms[roomID] {
			if id != client.ID {
				peer = c
				break
			}
		}

		if peer != nil {
			client.Peer = peer
			peer.Peer = client

			msg1, _ := json.Marshal(map[string]interface{}{
				"type":      "direct_call_start",
				"roomId":    roomID,
				"peerId":    peer.ID,
				"peerName":  peer.FullName,
				"initiator": true,
			})
			client.SafeWrite(msg1)

			msg2, _ := json.Marshal(map[string]interface{}{
				"type":      "direct_call_start",
				"roomId":    roomID,
				"peerId":    client.ID,
				"peerName":  client.FullName,
				"initiator": false,
			})
			peer.SafeWrite(msg2)
		}
	}
}

func (h *Hub) FindMatchForClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client.Peer != nil {
		peer := client.Peer
		peer.Peer = nil
		peer.RoomID = ""
		client.Peer = nil
		client.RoomID = ""

		disconnectMsg, _ := json.Marshal(map[string]string{
			"type":    "peer_disconnected",
			"message": "Partner requested next match",
		})
		peer.SafeWrite(disconnectMsg)
		h.matchClientUnlocked(peer)
	}

	h.matchClientUnlocked(client)
}

func (h *Hub) matchClientUnlocked(client *Client) {
	h.youtuberQueue = removeClientFromSlice(h.youtuberQueue, client)
	h.investorQueue = removeClientFromSlice(h.investorQueue, client)
	h.allQueue = removeClientFromSlice(h.allQueue, client)

	if client.TargetFilter == "youtuber" && len(h.youtuberQueue) > 0 {
		peer := h.youtuberQueue[0]
		h.youtuberQueue = h.youtuberQueue[1:]
		h.pairClientsUnlocked(client, peer)
		return
	}

	if client.TargetFilter == "investor" && len(h.investorQueue) > 0 {
		peer := h.investorQueue[0]
		h.investorQueue = h.investorQueue[1:]
		h.pairClientsUnlocked(client, peer)
		return
	}

	if client.TargetFilter == "all" && len(h.allQueue) > 0 {
		peer := h.allQueue[0]
		h.allQueue = h.allQueue[1:]
		h.pairClientsUnlocked(client, peer)
		return
	}

	if client.UserRole == "youtuber" {
		h.youtuberQueue = append(h.youtuberQueue, client)
	} else if client.UserRole == "investor" {
		h.investorQueue = append(h.investorQueue, client)
	} else {
		h.allQueue = append(h.allQueue, client)
	}
}

func (h *Hub) pairClientsUnlocked(c1, c2 *Client) {
	roomID := uuid.New().String()

	c1.RoomID = roomID
	c1.Peer = c2

	c2.RoomID = roomID
	c2.Peer = c1

	msg1, _ := json.Marshal(map[string]interface{}{
		"type":       "match_found",
		"roomId":     roomID,
		"peerId":     c2.ID,
		"peerName":   c2.FullName,
		"peerAvatar": c2.Avatar,
		"initiator":  true,
	})
	c1.SafeWrite(msg1)

	msg2, _ := json.Marshal(map[string]interface{}{
		"type":       "match_found",
		"roomId":     roomID,
		"peerId":     c1.ID,
		"peerName":   c1.FullName,
		"peerAvatar": c1.Avatar,
		"initiator":  false,
	})
	c2.SafeWrite(msg2)
}

func (h *Hub) UnregisterClient(client *Client) {
	h.mu.Lock()
	delete(h.clients, client.ID)

	if client.RoomID != "" && h.rooms[client.RoomID] != nil {
		delete(h.rooms[client.RoomID], client.ID)
		if len(h.rooms[client.RoomID]) == 0 {
			delete(h.rooms, client.RoomID)
		}
	}

	h.youtuberQueue = removeClientFromSlice(h.youtuberQueue, client)
	h.investorQueue = removeClientFromSlice(h.investorQueue, client)
	h.allQueue = removeClientFromSlice(h.allQueue, client)

	if client.Peer != nil {
		peer := client.Peer
		peer.Peer = nil
		peer.RoomID = ""

		disconnectMsg, _ := json.Marshal(map[string]string{
			"type":    "peer_disconnected",
			"message": "Partner left the stream",
		})
		peer.SafeWrite(disconnectMsg)
		h.matchClientUnlocked(peer)
	}

	h.BroadcastOnlineCount()
	h.mu.Unlock()
}

func (h *Hub) ForwardSignalToRoom(sender *Client, rawMsg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if sender.RoomID == "" {
		return
	}

	room, exists := h.rooms[sender.RoomID]
	if exists {
		for id, client := range room {
			if id != sender.ID {
				client.SafeWrite(rawMsg)
			}
		}
	}
}

func removeClientFromSlice(slice []*Client, target *Client) []*Client {
	result := make([]*Client, 0, len(slice))
	for _, c := range slice {
		if c.ID != target.ID {
			result = append(result, c)
		}
	}
	return result
}

func handleUploadContent(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	var filePath string
	if err == nil && file != nil {
		filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
		savePath := filepath.Join("./uploads", filename)
		if err := c.SaveFile(file, savePath); err == nil {
			filePath = "/uploads/" + filename
		}
	}

	title := c.FormValue("title")
	contentType := c.FormValue("type")

	return c.Status(201).JSON(fiber.Map{
		"message": "Content uploaded successfully",
		"content": fiber.Map{
			"id":    uuid.New().String(),
			"title": title,
			"type":  contentType,
			"url":   filePath,
		},
	})
}

func handleDeleteContent(c *fiber.Ctx) error {
	contentID := c.Params("id")
	if contentID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Content ID is required"})
	}

	return c.JSON(fiber.Map{
		"message":   "Content deleted successfully",
		"contentId": contentID,
	})
}

func main() {
	_ = os.MkdirAll("./uploads", os.ModePerm)

	app := fiber.New(fiber.Config{
		AppName:   "Live-Aleo Backend",
		BodyLimit: 50 * 1024 * 1024,
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	app.Static("/uploads", "./uploads")

	hub := newHub()

	setupRoutes := func(router fiber.Router) {
		router.Get("/user/profile", handleGetUserProfile)
		router.Put("/user/profile", handleUpdateUserProfile)
		router.Post("/signup", handleSignup)
		router.Post("/login", handleLogin)

		router.Post("/content/upload", handleUploadContent)
		router.Delete("/content/:id", handleDeleteContent)
	}

	setupRoutes(app.Group("/api"))
	setupRoutes(app.Group("/api/v1"))

	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			tokenStr := c.Query("token")
			if tokenStr != "" {
				claims, err := parseToken(tokenStr)
				if err == nil {
					c.Locals("userId", fmt.Sprintf("%v", claims.UserID))
					c.Locals("fullName", claims.Email)
					c.Locals("role", "user")
					c.Locals("avatar", "")
					return c.Next()
				}
			}

			guestID := uuid.New().String()
			c.Locals("userId", guestID)
			c.Locals("fullName", "Guest_"+guestID[:5])
			c.Locals("role", "user")
			c.Locals("avatar", "")
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/live", websocket.New(func(c *websocket.Conn) {
		realRole, _ := c.Locals("role").(string)
		if realRole == "" {
			realRole = "user"
		}

		targetFilter := c.Query("role")
		if targetFilter != "youtuber" && targetFilter != "investor" {
			targetFilter = "all"
		}

		userId, _ := c.Locals("userId").(string)
		fullName, _ := c.Locals("fullName").(string)
		avatar, _ := c.Locals("avatar").(string)

		client := &Client{
			ID:           uuid.New().String(),
			UserID:       userId,
			FullName:     fullName,
			Avatar:       avatar,
			Conn:         c,
			UserRole:     realRole,
			TargetFilter: targetFilter,
			sendChan:     make(chan []byte, 256),
		}

		hub.RegisterClient(client)

		go func() {
			for msg := range client.sendChan {
				if err := c.WriteMessage(websocket.TextMessage, msg); err != nil {
					break
				}
			}
		}()

		defer func() {
			hub.UnregisterClient(client)
			client.Close()
			c.Close()
		}()

		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				break
			}

			var sig SignalMessage
			if err := json.Unmarshal(message, &sig); err == nil {
				switch sig.Type {
				case "send_call_request":
					hub.HandleSendCallRequest(client, sig)
					continue
				case "accept_call_request":
					hub.HandleAcceptCallRequest(client, sig)
					continue
				case "decline_call_request":
					hub.HandleDeclineCallRequest(client, sig)
					continue
				case "init_direct_call":
					hub.HandleInitDirectCall(client, sig)
					continue
				case "find_match":
					hub.FindMatchForClient(client)
					continue
				case "leave":
					hub.mu.Lock()
					if client.Peer != nil {
						peer := client.Peer
						peer.Peer = nil
						peer.RoomID = ""

						disconnectMsg, _ := json.Marshal(map[string]string{
							"type":    "peer_disconnected",
							"message": "Partner left the stream",
						})
						peer.SafeWrite(disconnectMsg)
					}
					client.Peer = nil
					client.RoomID = ""
					hub.mu.Unlock()
					continue
				}
			}

			hub.mu.Lock()
			peer := client.Peer
			roomID := client.RoomID
			hub.mu.Unlock()

			if peer != nil {
				peer.SafeWrite(message)
			} else if roomID != "" {
				hub.ForwardSignalToRoom(client, message)
			}
		}
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Live-Aleo backend running on port :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}