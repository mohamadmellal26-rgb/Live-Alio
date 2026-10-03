package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Global DB variable (تأكد من تهيئته في ملف الـ Database الخاص بك)
var DB *gorm.DB

// User Model مع ضبط الـ ID ليتولد تلقائياً (Auto Increment) لتجنب خطأ الـ Null Constraint
type User struct {
	ID             uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	FullName       string         `json:"fullName"`
	Email          string         `json:"email" gorm:"unique"`
	Password       string         `json:"-"`
	Role           string         `json:"role"`
	Avatar         string         `json:"avatar"`
	Bio            string         `json:"bio"`
	Location       string         `json:"location"`
	Website        string         `json:"website"`
	TargetIndustry string         `json:"targetIndustry"`
	Skills         []string       `json:"skills" gorm:"serializer:json"`
	FocusAreas     []string       `json:"focusAreas" gorm:"serializer:json"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

// JWT Secret Key
var jwtSecret = []byte("your-super-secret-key-change-this-in-production")

// Custom Claims Structure
type Claims struct {
	UserID uint   `json:"userId"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// Helper to generate JWT Token
func generateToken(user User) (string, error) {
	claims := jwt.MapClaims{
		"userId": user.ID,
		"email":  user.Email,
		"exp":    time.Now().Add(time.Hour * 72).Unix(), // Expires in 3 days
		"iat":    time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// Helper to parse JWT Token
func parseToken(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}

	return claims, nil
}

// Helper to save uploaded files (like Avatar)
func saveUploadedFile(c *fiber.Ctx, fieldName string) (string, error) {
	file, err := c.FormFile(fieldName)
	if err != nil {
		return "", err
	}

	// Create uploads directory if it doesn't exist
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		return "", err
	}

	// Generate unique filename
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
	filePath := filepath.Join(uploadDir, filename)

	// Save file to destination
	if err := c.SaveFile(file, filePath); err != nil {
		return "", err
	}

	// Return public URL path
	return fmt.Sprintf("/uploads/%s", filename), nil
}

// Signup Handler (يدعم JSON و Multipart Form-Data مع حفظ الصورة الشخصية)
func handleSignup(c *fiber.Ctx) error {
	contentType := c.Get("Content-Type")

	var fullName, email, password, role string

	if strings.Contains(contentType, "application/json") {
		type RegisterInput struct {
			FullName string `json:"fullName"`
			Email    string `json:"email"`
			Password string `json:"password"`
			Role     string `json:"role"`
		}

		var input RegisterInput
		if err := c.BodyParser(&input); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
		}
		fullName = input.FullName
		email = input.Email
		password = input.Password
		role = input.Role
	} else {
		// استقبال البيانات المرسلة عبر FormData
		fullName = c.FormValue("fullName")
		email = c.FormValue("email")
		password = c.FormValue("password")
		role = c.FormValue("role")
	}

	if role == "" {
		role = "Developer" // القيمة الافتراضية
	}

	// Validate inputs
	if strings.TrimSpace(fullName) == "" || strings.TrimSpace(email) == "" || strings.TrimSpace(password) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "All fields are required"})
	}

	// Check if user already exists
	var existingUser User
	if err := DB.Where("email = ?", strings.ToLower(email)).First(&existingUser).Error; err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Email already registered"})
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	// Create new user record
	newUser := User{
		FullName: fullName,
		Email:    strings.ToLower(email),
		Password: string(hashedPassword),
		Role:     role,
	}

	// معالجة وحفظ صورة البروفايل إذا تم رفعها أثناء التسجيل
	if avatarPath, err := saveUploadedFile(c, "avatar"); err == nil && avatarPath != "" {
		newUser.Avatar = avatarPath
	}

	if err := DB.Create(&newUser).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user"})
	}

	// Generate JWT Token
	token, err := generateToken(newUser)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate auth token"})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "User registered successfully",
		"token":   token,
		"user":    newUser,
	})
}

// Login Handler
func handleLogin(c *fiber.Ctx) error {
	type LoginInput struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var input LoginInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if strings.TrimSpace(input.Email) == "" || strings.TrimSpace(input.Password) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Email and password are required"})
	}

	var user User
	if err := DB.Where("email = ?", strings.ToLower(input.Email)).First(&user).Error; err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	// Check password match
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	// Generate JWT Token
	token, err := generateToken(user)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate auth token"})
	}

	return c.JSON(fiber.Map{
		"message": "Login successful",
		"token":   token,
		"user":    user,
	})
}

// Get Current User Profile Handler
func handleGetUserProfile(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := parseToken(tokenStr)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid or expired token"})
	}

	// تحويل الـ ID قادماً من الـ JWT map claims بأمان إلى uint
	idFloat, ok := claims["userId"].(float64)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token payload"})
	}
	userID := uint(idFloat)

	var user User
	if err := DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(user)
}

// Update User Profile Handler (Supports both JSON & Multipart Form Data)
func handleUpdateUserProfile(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	claims, err := parseToken(tokenStr)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid or expired token"})
	}

	idFloat, ok := claims["userId"].(float64)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token payload"})
	}
	userID := uint(idFloat)

	var user User
	if err := DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	contentType := c.Get("Content-Type")

	// معالجة البيانات بناءً على نوع الـ Content-Type لضمان قراءتها بشكل صحيح
	if strings.Contains(contentType, "application/json") {
		type UpdateProfileJSON struct {
			FullName       string   `json:"fullName"`
			Role           string   `json:"role"`
			Bio            string   `json:"bio"`
			Location       string   `json:"location"`
			Website        string   `json:"website"`
			TargetIndustry string   `json:"targetIndustry"`
			Skills         []string `json:"skills"`
			FocusAreas     []string `json:"focusAreas"`
		}

		var jsonReq UpdateProfileJSON
		if err := c.BodyParser(&jsonReq); err == nil {
			if jsonReq.FullName != "" { user.FullName = jsonReq.FullName }
			if jsonReq.Role != "" { user.Role = jsonReq.Role }
			if jsonReq.Bio != "" { user.Bio = jsonReq.Bio }
			if jsonReq.Location != "" { user.Location = jsonReq.Location }
			if jsonReq.Website != "" { user.Website = jsonReq.Website }
			if jsonReq.TargetIndustry != "" { user.TargetIndustry = jsonReq.TargetIndustry }
			if len(jsonReq.Skills) > 0 { user.Skills = jsonReq.Skills }
			if len(jsonReq.FocusAreas) > 0 { user.FocusAreas = jsonReq.FocusAreas }
		}
	} else {
		// معالجة البيانات القادمة كـ Multipart/Form-Data
		if fullName := c.FormValue("fullName"); fullName != "" {
			user.FullName = fullName
		}
		if role := c.FormValue("role"); role != "" {
			user.Role = role
		}
		if bio := c.FormValue("bio"); bio != "" {
			user.Bio = bio
		}
		if location := c.FormValue("location"); location != "" {
			user.Location = location
		}
		if website := c.FormValue("website"); website != "" {
			user.Website = website
		}
		if targetIndustry := c.FormValue("targetIndustry"); targetIndustry != "" {
			user.TargetIndustry = targetIndustry
		}

		if skillsRaw := c.FormValue("skills"); skillsRaw != "" {
			var parsedSkills []string
			if err := json.Unmarshal([]byte(skillsRaw), &parsedSkills); err == nil {
				user.Skills = parsedSkills
			}
		}

		if focusRaw := c.FormValue("focusAreas"); focusRaw != "" {
			var parsedFocus []string
			if err := json.Unmarshal([]byte(focusRaw), &parsedFocus); err == nil {
				user.FocusAreas = parsedFocus
			}
		}
	}

	// تحديث ملف الصورة إذا وجد
	if avatarPath, err := saveUploadedFile(c, "avatar"); err == nil && avatarPath != "" {
		user.Avatar = avatarPath
	}

	// حفظ البيانات المحدثة في القاعدة
	if err := DB.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update profile"})
	}

	return c.JSON(fiber.Map{
		"message": "Profile updated successfully",
		"user":    user,
	})
}

func main() {
	app := fiber.New()

	// تفعيل مسار الملفات المرفوعة لعرض الصور
	app.Static("/uploads", "./uploads")

	// مسارات الـ API
	api := app.Group("/api/v1")
	api.Post("/signup", handleSignup)
	api.Post("/login", handleLogin)
	api.Get("/profile", handleGetUserProfile)
	api.Put("/profile", handleUpdateUserProfile)

	// تشغيل الخادم على المنفذ 10000 (المناسب لـ Render)
	log.Fatal(app.Listen(":10000"))
}