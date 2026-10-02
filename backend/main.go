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
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var jwtSecret = []byte("super_secret_live_aleo_key_2026")

type User struct {
	ID           string `json:"id"`
	FullName     string `json:"fullName"`
	Email        string `json:"email"`
	Password     string `json:"-"`
	Role         string `json:"role"`
	Avatar       string `json:"avatar,omitempty"`
	YoutubeUrl   string `json:"youtubeUrl,omitempty"`
	PyCardId     string `json:"pyCardId,omitempty"`
	ProjectProof string `json:"projectProof,omitempty"`
}

type RegisterRequest struct {
	FullName   string `json:"fullName" form:"fullName"`
	Email      string `json:"email" form:"email"`
	Password   string `json:"password" form:"password"`
	Role       string `json:"role" form:"role"`
	YoutubeUrl string `json:"youtubeUrl,omitempty" form:"youtubeUrl"`
	PyCardId   string `json:"pyCardId,omitempty" form:"pyCardId"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SignalMessage struct {
	Type      string      `json:"type"`
	Offer     interface{} `json:"offer,omitempty"`
	Answer    interface{} `json:"answer,omitempty"`
	Candidate interface{} `json:"candidate,omitempty"`
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
	mu           sync.Mutex
}

func (c *Client) SafeWrite(msg []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.sendChan != nil {
		select {
		case c.sendChan <- msg:
		default:
			log.Printf("Send buffer full for client %s, dropping message", c.ID)
		}
	}
}

type UserStore struct {
	users map[string]*User
	mu    sync.RWMutex
}

var userStore = &UserStore{users: make(map[string]*User)}

type Hub struct {
	youtuberQueue []*Client
	investorQueue []*Client
	allQueue      []*Client
	clients       map[string]*Client
	mu            sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		youtuberQueue: make([]*Client, 0),
		investorQueue: make([]*Client, 0),
		allQueue:      make([]*Client, 0),
		clients:       make(map[string]*Client),
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
	log.Printf("Client registered: %s (%s)", client.ID, client.FullName)

	h.matchClientUnlocked(client)
	h.BroadcastOnlineCount()
	h.mu.Unlock()
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

	log.Printf("Matched room %s: %s <---> %s", roomID, c1.FullName, c2.FullName)
}

func (h *Hub) UnregisterClient(client *Client) {
	h.mu.Lock()

	delete(h.clients, client.ID)

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

func removeClientFromSlice(slice []*Client, target *Client) []*Client {
	result := make([]*Client, 0, len(slice))
	for _, c := range slice {
		if c.ID != target.ID {
			result = append(result, c)
		}
	}
	return result
}

func generateToken(user *User) (string, error) {
	claims := jwt.MapClaims{
		"userId":   user.ID,
		"email":    user.Email,
		"fullName": user.FullName,
		"role":     user.Role,
		"avatar":   user.Avatar,
		"exp":      time.Now().Add(time.Hour * 72).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func parseToken(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fiber.ErrUnauthorized
	}
	return claims, nil
}

func saveUploadedFile(c *fiber.Ctx, formKey string) (string, error) {
	file, err := c.FormFile(formKey)
	if err != nil {
		return "", nil // الملف غير موجود في الطلب
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().UnixNano(), ext)
	savePath := filepath.Join("./uploads", filename)

	if err := c.SaveFile(file, savePath); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}

func main() {
	_ = os.MkdirAll("./uploads", os.ModePerm)

	app := fiber.New(fiber.Config{
		AppName:   "Live-Aleo Backend",
		BodyLimit: 20 * 1024 * 1024, // زيادة الحد لتسجيل الملفات والصور
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	app.Static("/uploads", "./uploads")

	hub := newHub()

	api := app.Group("/api/v1")

	api.Post("/signup", func(c *fiber.Ctx) error {
		var req RegisterRequest

		// محاولة قراءة البيانات سواء كانت JSON أو Multipart Form
		if err := c.BodyParser(&req); err != nil {
			req.FullName = c.FormValue("fullName")
			req.Email = c.FormValue("email")
			req.Password = c.FormValue("password")
			req.Role = c.FormValue("role")
			req.YoutubeUrl = c.FormValue("youtubeUrl")
			req.PyCardId = c.FormValue("pyCardId")
		}

		if req.Email == "" || req.Password == "" || req.FullName == "" {
			return c.Status(400).JSON(fiber.Map{"error": "Missing required fields"})
		}

		if req.Role == "" {
			req.Role = "user"
		}

		userStore.mu.Lock()
		if _, exists := userStore.users[req.Email]; exists {
			userStore.mu.Unlock()
			return c.Status(400).JSON(fiber.Map{"error": "Email already exists"})
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			userStore.mu.Unlock()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to process password"})
		}

		// حفظ صورة الملف الشخصي إذا تم رفعها
		avatarPath, err := saveUploadedFile(c, "avatar")
		if err != nil {
			userStore.mu.Unlock()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save avatar image"})
		}

		// حفظ إثبات المشروع (إضافي) إذا تم رفعه
		proofPath, err := saveUploadedFile(c, "projectProof")
		if err != nil {
			userStore.mu.Unlock()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save project proof file"})
		}

		newUser := &User{
			ID:           uuid.New().String(),
			FullName:     req.FullName,
			Email:        req.Email,
			Password:     string(hashedPassword),
			Role:         req.Role,
			Avatar:       avatarPath,
			YoutubeUrl:   req.YoutubeUrl,
			PyCardId:     req.PyCardId,
			ProjectProof: proofPath,
		}

		userStore.users[req.Email] = newUser
		userStore.mu.Unlock()

		token, err := generateToken(newUser)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
		}

		return c.Status(201).JSON(fiber.Map{
			"token": token,
			"user":  newUser,
		})
	})

	api.Post("/login", func(c *fiber.Ctx) error {
		var req LoginRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
		}

		userStore.mu.RLock()
		user, exists := userStore.users[req.Email]
		userStore.mu.RUnlock()

		if !exists || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid email or password"})
		}

		token, err := generateToken(user)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
		}

		return c.JSON(fiber.Map{
			"token": token,
			"user":  user,
		})
	})

	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			tokenStr := c.Query("token")
			if tokenStr != "" {
				claims, err := parseToken(tokenStr)
				if err == nil {
					c.Locals("userId", claims["userId"])
					c.Locals("fullName", claims["fullName"])
					c.Locals("role", claims["role"])
					c.Locals("avatar", claims["avatar"])
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
			close(client.sendChan)
			c.Close()
		}()

		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				break
			}

			var sig SignalMessage
			if err := json.Unmarshal(message, &sig); err == nil {
				if sig.Type == "find_match" {
					hub.FindMatchForClient(client)
					continue
				}

				if sig.Type == "leave" {
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

			client.mu.Lock()
			peer := client.Peer
			client.mu.Unlock()

			if peer != nil {
				peer.SafeWrite(message)
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