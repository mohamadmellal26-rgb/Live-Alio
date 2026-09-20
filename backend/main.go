package main

import (
	"encoding/json"
	"log"
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

// JWT Secret Key
var jwtSecret = []byte("super_secret_live_aleo_key_2026")

// =================== Models ===================

type User struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Password string `json:"-"`
}

type RegisterRequest struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type Client struct {
	ID       string          `json:"id"`
	UserID   string          `json:"userId"`
	FullName string          `json:"fullName"`
	Conn     *websocket.Conn `json:"-"`
	Role     string          `json:"role"` // "youtuber" أو "all"
	Peer     *Client         `json:"-"`    // الطرف الآخر المقترن به
	RoomID   string          `json:"roomId,omitempty"`
	mu       sync.Mutex
}

type SignalMessage struct {
	Type    string          `json:"type"` // "match_found", "offer", "answer", "ice_candidate", "chat"
	Target  string          `json:"target,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// =================== In-Memory Database & Hub ===================

type UserStore struct {
	users map[string]*User // email -> User
	mu    sync.RWMutex
}

var userStore = &UserStore{users: make(map[string]*User)}

type Hub struct {
	youtuberQueue []*Client
	allQueue      []*Client
	clients       map[string]*Client
	mu            sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		youtuberQueue: make([]*Client, 0),
		allQueue:      make([]*Client, 0),
		clients:       make(map[string]*Client),
	}
}

func (h *Hub) RegisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[client.ID] = client
	log.Printf("Client registered: %s (User: %s, Role: %s)", client.ID, client.FullName, client.Role)

	h.matchClient(client)
}

func (h *Hub) matchClient(client *Client) {
	if client.Role == "youtuber" {
		if len(h.youtuberQueue) > 0 {
			peer := h.youtuberQueue[0]
			h.youtuberQueue = h.youtuberQueue[1:]
			h.pairClients(client, peer)
			return
		}
		h.youtuberQueue = append(h.youtuberQueue, client)
	} else {
		if len(h.allQueue) > 0 {
			peer := h.allQueue[0]
			h.allQueue = h.allQueue[1:]
			h.pairClients(client, peer)
			return
		}
		h.allQueue = append(h.allQueue, client)
	}
}

func (h *Hub) pairClients(c1, c2 *Client) {
	roomID := uuid.New().String()

	c1.mu.Lock()
	c1.Peer = c2
	c1.RoomID = roomID
	c1.mu.Unlock()

	c2.mu.Lock()
	c2.Peer = c1
	c2.RoomID = roomID
	c2.mu.Unlock()

	msg1, _ := json.Marshal(map[string]interface{}{
		"type":      "match_found",
		"roomId":    roomID,
		"peerId":    c2.ID,
		"peerName":  c2.FullName,
		"initiator": true,
	})
	c1.Conn.WriteMessage(websocket.TextMessage, msg1)

	msg2, _ := json.Marshal(map[string]interface{}{
		"type":      "match_found",
		"roomId":    roomID,
		"peerId":    c1.ID,
		"peerName":  c1.FullName,
		"initiator": false,
	})
	c2.Conn.WriteMessage(websocket.TextMessage, msg2)

	log.Printf("Matched room %s: %s <---> %s", roomID, c1.FullName, c2.FullName)
}

func (h *Hub) UnregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.clients, client.ID)

	h.youtuberQueue = removeClientFromSlice(h.youtuberQueue, client)
	h.allQueue = removeClientFromSlice(h.allQueue, client)

	if client.Peer != nil {
		peer := client.Peer
		peer.mu.Lock()
		peer.Peer = nil
		peer.RoomID = ""
		peer.mu.Unlock()

		disconnectMsg, _ := json.Marshal(map[string]string{
			"type":    "peer_disconnected",
			"message": "Partner left the stream",
		})
		peer.Conn.WriteMessage(websocket.TextMessage, disconnectMsg)
	}

	log.Printf("Client disconnected: %s", client.ID)
}

func removeClientFromSlice(slice []*Client, target *Client) []*Client {
	result := make([]*Client, 0)
	for _, c := range slice {
		if c.ID != target.ID {
			result = append(result, c)
		}
	}
	return result
}

// =================== JWT Helpers ===================

func generateToken(user *User) (string, error) {
	claims := jwt.MapClaims{
		"userId":   user.ID,
		"email":    user.Email,
		"fullName": user.FullName,
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

// =================== Main Server ===================

func main() {
	app := fiber.New(fiber.Config{
		AppName: "Live-Aleo Backend",
	})

	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	hub := newHub()

	// ---------------- Auth Routes ----------------
	api := app.Group("/api/v1")

	// Register / Sign Up
	api.Post("/signup", func(c *fiber.Ctx) error {
		var req RegisterRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
		}

		userStore.mu.Lock()
		defer userStore.mu.Unlock()

		if _, exists := userStore.users[req.Email]; exists {
			return c.Status(400).JSON(fiber.Map{"error": "Email already exists"})
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to process password"})
		}

		newUser := &User{
			ID:       uuid.New().String(),
			FullName: req.FullName,
			Email:    req.Email,
			Password: string(hashedPassword),
		}

		userStore.users[req.Email] = newUser

		token, err := generateToken(newUser)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
		}

		return c.Status(201).JSON(fiber.Map{
			"token": token,
			"user":  newUser,
		})
	})

	// Login
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

	// ---------------- WebSocket Authentication Middleware ----------------
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			tokenStr := c.Query("token")
			if tokenStr == "" {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing auth token"})
			}

			claims, err := parseToken(tokenStr)
			if err != nil {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or expired token"})
			}

			c.Locals("userId", claims["userId"])
			c.Locals("fullName", claims["fullName"])

			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	// ---------------- WebSocket Connection Point ----------------
	// Example Call: ws://localhost:8080/ws/live?role=youtuber&token=YOUR_JWT_TOKEN
	app.Get("/ws/live", websocket.New(func(c *websocket.Conn) {
		role := c.Query("role", "all")
		if role != "youtuber" && role != "all" {
			role = "all"
		}

		userId, _ := c.Locals("userId").(string)
		fullName, _ := c.Locals("fullName").(string)

		client := &Client{
			ID:       uuid.New().String(),
			UserID:   userId,
			FullName: fullName,
			Conn:     c,
			Role:     role,
		}

		hub.RegisterClient(client)

		defer func() {
			hub.UnregisterClient(client)
			c.Close()
		}()

		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				break
			}

			client.mu.Lock()
			peer := client.Peer
			client.mu.Unlock()

			if peer != nil {
				if err := peer.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
					log.Printf("Error sending message to peer: %v", err)
				}
			}
		}
	}))

	app.Get("/api/v1/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":  "success",
			"message": "Live-Aleo server is running smoothly",
		})
	})

	log.Println("Live-Aleo backend running on :8080")
	if err := app.Listen(":8080"); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}