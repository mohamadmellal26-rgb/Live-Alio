package main

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// PitchNotification هيكل بيانات طلبات الاتصال والإشعارات المباشرة
type PitchNotification struct {
	Type           string `json:"type"` // "pitch_request", "pitch_response", "pitch_cancel"
	NotificationID string `json:"notificationId,omitempty"`
	FromUserID     string `json:"fromUserId"`
	FromUserName   string `json:"fromUserName"`
	FromAvatar     string `json:"fromAvatar,omitempty"`
	ToUserID       string `json:"toUserId"`
	Note           string `json:"note,omitempty"`     // ملخص العرض أو الرسالة
	Accepted       bool   `json:"accepted,omitempty"` // حالة القبول أو الرفض
	RoomID         string `json:"roomId,omitempty"`   // معرف الغرفة عند القبول
}

// NotificationClient يمثل العميل المتصل المخصص لاستقبال الإشعارات
type NotificationClient struct {
	ID       string          `json:"id"`
	UserID   string          `json:"userId"`
	UserName string          `json:"userName"`
	Conn     *websocket.Conn `json:"-"`
	sendChan chan []byte     `json:"-"`
	isClosed bool
	mu       sync.Mutex
}

// SafeWrite لكتابة الرسائل بشكل آمن داخل القناة دون التسبب في panic
func (nc *NotificationClient) SafeWrite(msg []byte) {
	nc.mu.Lock()
	defer nc.mu.Unlock()

	if nc.isClosed || nc.sendChan == nil {
		return
	}

	select {
	case nc.sendChan <- msg:
	default:
		log.Printf("[NotifHub] Notification buffer full for user %s, dropping message", nc.UserID)
	}
}

// Close لإغلاق الاتصال والقناة بأمان
func (nc *NotificationClient) Close() {
	nc.mu.Lock()
	defer nc.mu.Unlock()

	if !nc.isClosed {
		nc.isClosed = true
		if nc.sendChan != nil {
			close(nc.sendChan)
		}
	}
}

// NotificationHub إدارة كافة اتصالات الإشعارات الفورية
type NotificationHub struct {
	// خريطة تربط userId بـ خريطة اتصالات (لتدعم فتح أكثر من تبويب أو جهاز لنفس المستخدم)
	userConnections map[string]map[string]*NotificationClient
	mu              sync.Mutex
}

var notifHub = &NotificationHub{
	userConnections: make(map[string]map[string]*NotificationClient),
}

// Register تسجيل اتصال جديد للمستخدم
func (nh *NotificationHub) Register(client *NotificationClient) {
	nh.mu.Lock()
	defer nh.mu.Unlock()

	if _, exists := nh.userConnections[client.UserID]; !exists {
		nh.userConnections[client.UserID] = make(map[string]*NotificationClient)
	}
	nh.userConnections[client.UserID][client.ID] = client
	log.Printf("[NotifHub] User registered for notifications: %s (ConnID: %s)", client.UserID, client.ID)
}

// Unregister إلغاء تسجيل الاتصال عند انقطاعه
func (nh *NotificationHub) Unregister(client *NotificationClient) {
	nh.mu.Lock()
	defer nh.mu.Unlock()

	if conns, exists := nh.userConnections[client.UserID]; exists {
		delete(conns, client.ID)
		if len(conns) == 0 {
			delete(nh.userConnections, client.UserID)
		}
	}
	log.Printf("[NotifHub] User unregistered from notifications: %s (ConnID: %s)", client.UserID, client.ID)
}

// SendToUser إرسال الإشعار لجميع الأجهزة والتبويبات النشطة للمستخدم
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

// HandleIncomingNotification معالجة وتوجيه الإشارات الواردة
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
			// إشعار المرسل بأن المستخدم المستهدف غير متصل حالياً
			ack, _ := json.Marshal(map[string]interface{}{
				"type":     "pitch_error",
				"message":  "المستخدم غير متصل حالياً",
				"toUserId": notif.ToUserID,
			})
			sender.SafeWrite(ack)
		} else {
			log.Printf("[NotifHub] Pitch call sent from %s to %s", notif.FromUserID, notif.ToUserID)
		}

	case "pitch_response":
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

		// إعادة النتيجة إلى الطالب الأصلي للاتصال
		nh.SendToUser(notif.ToUserID, payload)

		// في حال القبول، يتم تزويد القابل بنفس الـ roomId للدخول الفوري للغرفة
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

// SetupNotificationRoutes تسجيل مسارات الـ HTTP والـ WebSocket للإشعارات
func SetupNotificationRoutes(app *fiber.App) {
	app.Use("/ws/notifications", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			tokenStr := c.Query("token")
			if tokenStr != "" {
				claims, err := parseToken(tokenStr)
				if err == nil {
					// التعديل هنا ليتوافق مع هيكل الـ Claims الجديد (Struct)
					if claims.UserID != 0 {
						c.Locals("userId", fmt.Sprintf("%v", claims.UserID))
					}
					if claims.Email != "" {
						c.Locals("fullName", claims.Email)
					}
					return c.Next()
				}
			}

			userID := c.Query("userId")
			if userID != "" {
				c.Locals("userId", userID)
				fallbackName := "User_"
				if len(userID) >= 5 {
					fallbackName += userID[:5]
				} else {
					fallbackName += userID
				}
				c.Locals("fullName", c.Query("userName", fallbackName))
				return c.Next()
			}

			return fiber.ErrUnauthorized
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/notifications", websocket.New(func(c *websocket.Conn) {
		userID, _ := c.Locals("userId").(string)
		userName, _ := c.Locals("fullName").(string)

		if userID == "" {
			c.Close()
			return
		}

		client := &NotificationClient{
			ID:       uuid.New().String(),
			UserID:   userID,
			UserName: userName,
			Conn:     c,
			sendChan: make(chan []byte, 256),
		}

		notifHub.Register(client)

		// الـ Goroutine المخصصة للكتابة على الـ WebSocket
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

		// الحلقة الرئيسية لقراءة الرسائل الواردة
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				break
			}
			notifHub.HandleIncomingNotification(client, message)
		}
	}))
}