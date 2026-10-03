package main

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// PitchNotification structure for direct call requests
type PitchNotification struct {
	Type         string `json:"type"`                   // "pitch_request", "pitch_response", "pitch_cancel"
	NotificationID string `json:"notificationId,omitempty"`
	FromUserID   string `json:"fromUserId"`
	FromUserName string `json:"fromUserName"`
	FromAvatar   string `json:"fromAvatar,omitempty"`
	ToUserID     string `json:"toUserId"`
	Note         string `json:"note,omitempty"`         // Pitch summary or message
	Accepted     bool   `json:"accepted,omitempty"`     // Response flag
	RoomID       string `json:"roomId,omitempty"`       // Generated stream room id on acceptance
}

// NotificationClient represents a connected user listening for notifications
type NotificationClient struct {
	ID       string          `json:"id"`
	UserID   string          `json:"userId"`
	UserName string          `json:"userName"`
	Conn     *websocket.Conn `json:"-"`
	sendChan chan []byte     `json:"-"`
	isClosed bool
	mu       sync.Mutex
}

func (nc *NotificationClient) SafeWrite(msg []byte) {
	nc.mu.Lock()
	defer nc.mu.Unlock()
	if nc.isClosed || nc.sendChan == nil {
		return
	}
	select {
	case nc.sendChan <- msg:
	default:
		log.Printf("Notification buffer full for user %s, dropping message", nc.UserID)
	}
}

func (nc *NotificationClient) Close() {
	nc.mu.Lock()
	defer nc.mu.Unlock()
	if !nc.isClosed {
		nc.isClosed = true
		close(nc.sendChan)
	}
}

// NotificationHub manages connected users for real-time notifications
type NotificationHub struct {
	// Map of userId -> map of connection IDs (supports multiple devices/tabs per user)
	userConnections map[string]map[string]*NotificationClient
	mu              sync.Mutex
}

var notifHub = &NotificationHub{
	userConnections: make(map[string]map[string]*NotificationClient),
}

func (nh *NotificationHub) Register(client *NotificationClient) {
	nh.mu.Lock()
	defer nh.mu.Unlock()

	if _, exists := nh.userConnections[client.UserID]; !exists {
		nh.userConnections[client.UserID] = make(map[string]*NotificationClient)
	}
	nh.userConnections[client.UserID][client.ID] = client
	log.Printf("[NotifHub] User registered for notifications: %s (ConnID: %s)", client.UserID, client.ID)
}

func (nh *NotificationHub) Unregister(client *NotificationClient) {
	nh.mu.Lock()
	defer nh.mu.Unlock()

	if conns, exists := nh.userConnections[client.UserID]; exists {
		delete(conns, client.ID)
		if len(conns) == 0 {
			delete(nh.userConnections, client.UserID)
		}
	}
	log.Printf("[NotifHub] User unregistered from notifications: %s", client.UserID)
}

// SendToUser sends a notification message to all active connections of a specific user
func (nh *NotificationHub) SendToUser(userID string, payload []byte) bool {
	nh.mu.Lock()
	defer nh.mu.Unlock()

	conns, exists := nh.userConnections[userID]
	if !exists || len(conns) == 0 {
		return false
	}

	for _, client := range conns {
		client.SafeWrite(payload)
	}
	return true
}

// HandleIncomingNotification parses and routes notification signals
func (nh *NotificationHub) HandleIncomingNotification(sender *NotificationClient, msg []byte) {
	var notif PitchNotification
	if err := json.Unmarshal(msg, &notif); err != nil {
		log.Printf("[NotifHub] Error unmarshalling notification: %v", err)
		return
	}

	switch notif.Type {
	case "pitch_request":
		notif.NotificationID = uuid.New().String()
		if notif.FromUserID == "" {
			notif.FromUserID = sender.UserID
		}
		if notif.FromUserName == "" {
			notif.FromUserName = sender.UserName
		}

		payload, _ := json.Marshal(map[string]interface{}{
			"type":           "pitch_incoming",
			"notificationId": notif.NotificationID,
			"fromUserId":     notif.FromUserID,
			"fromUserName":   notif.FromUserName,
			"fromAvatar":     notif.FromAvatar,
			"toUserId":       notif.ToUserID,
			"note":           notif.Note,
		})

		sent := nh.SendToUser(notif.ToUserID, payload)
		if !sent {
			// User is offline or not connected to notification hub
			ack, _ := json.Marshal(map[string]interface{}{
				"type":    "pitch_error",
				"message": "المستخدم غير متصل حالياً",
				"toUserId": notif.ToUserID,
			})
			sender.SafeWrite(ack)
		} else {
			log.Printf("[NotifHub] Pitch call sent from %s to %s", notif.FromUserID, notif.ToUserID)
		}

	case "pitch_response":
		// Sender responded (accepted or declined)
		var roomID string
		if notif.Accepted {
			roomID = uuid.New().String()
		}

		payload, _ := json.Marshal(map[string]interface{}{
			"type":           "pitch_result",
			"notificationId": notif.NotificationID,
			"accepted":       notif.Accepted,
			"fromUserId":     sender.UserID,
			"roomId":         roomID,
		})

		// Send result back to the original caller
		nh.SendToUser(notif.ToUserID, payload)

		// Send same result to acceptor to sync room joining
		if notif.Accepted {
			selfPayload, _ := json.Marshal(map[string]interface{}{
				"type":     "pitch_result",
				"accepted": true,
				"roomId":   roomID,
			})
			sender.SafeWrite(selfPayload)
		}

	case "pitch_cancel":
		payload, _ := json.Marshal(map[string]interface{}{
			"type":           "pitch_canceled",
			"notificationId": notif.NotificationID,
			"fromUserId":     sender.UserID,
		})
		nh.SendToUser(notif.ToUserID, payload)
	}
}

// SetupNotificationRoutes registers HTTP / WS routes for notification server
func SetupNotificationRoutes(app *fiber.App) {
	app.Use("/ws/notifications", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			tokenStr := c.Query("token")
			if tokenStr != "" {
				claims, err := parseToken(tokenStr)
				if err == nil {
					c.Locals("userId", claims["userId"])
					c.Locals("fullName", claims["fullName"])
					return c.Next()
				}
			}

			userID := c.Query("userId")
			if userID != "" {
				c.Locals("userId", userID)
				c.Locals("fullName", c.Query("userName", "User_"+userID[:5]))
				return c.Next()
			}

			return fiber.ErrUnauthorized
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/notifications", websocket.New(func(c *websocket.Conn) {
		userID, _ := c.Locals("userId").(string)
		userName, _ := c.Locals("fullName").(string)

		client := &NotificationClient{
			ID:       uuid.New().String(),
			UserID:   userID,
			UserName: userName,
			Conn:     c,
			sendChan: make(chan []byte, 256),
		}

		notifHub.Register(client)

		// Writer Goroutine
		go func() {
			for msg := range client.sendChan {
				if err := c.WriteMessage(websocket.TextMessage, msg); err != nil {
					break
				}
			}
		}()

		defer func() {
			notifHub.Unregister(client)
			client.Close()
			c.Close()
		}()

		// Reader Loop
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				break
			}
			notifHub.HandleIncomingNotification(client, message)
		}
	}))
}