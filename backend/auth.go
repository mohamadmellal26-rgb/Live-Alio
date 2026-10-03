package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var jwtSecret = []byte("super_secret_live_aleo_key_2026")

// نموذج المستخدم في قاعدة البيانات
type User struct {
	ID             string   `gorm:"primaryKey;type:uuid" json:"id"`
	FullName       string   `gorm:"not null" json:"fullName"`
	Email          string   `gorm:"uniqueIndex;not null" json:"email"`
	Password       string   `gorm:"not null" json:"-"`
	Role           string   `gorm:"default:'user'" json:"role"`
	Avatar         string   `json:"avatarUrl,omitempty"`
	Bio            string   `json:"bio,omitempty"`
	Location       string   `json:"location,omitempty"`
	Website        string   `json:"website,omitempty"`
	TargetIndustry string   `json:"targetIndustry,omitempty"`
	Skills         []string `gorm:"serializer:json" json:"skills,omitempty"`
	FocusAreas     []string `gorm:"serializer:json" json:"focusAreas,omitempty"`
	IsVerified     bool     `gorm:"default:true" json:"isVerified"`
	JoinedDate     string   `json:"joinedDate"`
	YoutubeUrl     string   `json:"youtubeUrl,omitempty"`
	PyCardId       string   `json:"pyCardId,omitempty"`
	ProjectProof   string   `json:"projectProof,omitempty"`
	CreatedAt      time.Time`json:"createdAt"`
	UpdatedAt      time.Time`json:"updatedAt"`
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
		return "", nil
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().UnixNano(), ext)
	savePath := filepath.Join("./uploads", filename)

	if err := c.SaveFile(file, savePath); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}

// Handler لإنشاء حساب جديد وتخزينه في PostgreSQL
func handleSignup(c *fiber.Ctx) error {
	var req RegisterRequest

	if err := c.BodyParser(&req); err != nil {
		req.FullName = c.FormValue("fullName")
		req.Email = c.FormValue("email")
		req.Password = c.FormValue("password")
		req.Role = c.FormValue("role")
		req.YoutubeUrl = c.FormValue("youtubeUrl")
		req.PyCardId = c.FormValue("pyCardId")
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	if req.Email == "" || req.Password == "" || req.FullName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing required fields"})
	}

	if req.Role == "" {
		req.Role = "user"
	}

	// التحقق من وجود الإيميل مسبقاً من قاعدة البيانات
	var existingUser User
	if err := DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Email already exists"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to process password"})
	}

	avatarPath, _ := saveUploadedFile(c, "avatar")
	proofPath, _ := saveUploadedFile(c, "projectProof")

	newUser := User{
		ID:           uuid.New().String(),
		FullName:     req.FullName,
		Email:        req.Email,
		Password:     string(hashedPassword),
		Role:         req.Role,
		Avatar:       avatarPath,
		Bio:          "Full-Stack Software Engineer & Platform Innovator",
		JoinedDate:   time.Now().Format("Jan 2006"),
		IsVerified:   true,
		YoutubeUrl:   req.YoutubeUrl,
		PyCardId:     req.PyCardId,
		ProjectProof: proofPath,
	}

	// حفظ المستخدم في قاعدة البيانات PostgreSQL
	if err := DB.Create(&newUser).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user in database"})
	}

	token, err := generateToken(&newUser)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.Status(201).JSON(fiber.Map{
		"token": token,
		"user":  newUser,
	})
}

// Handler لتسجيل الدخول باستعلام PostgreSQL
func handleLogin(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user User
	if err := DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid email or password"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Database error"})
	}

	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	token, err := generateToken(&user)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	return c.JSON(fiber.Map{
		"token": token,
		"user":  user,
	})
}

// Handler لجلب البروفايل من قاعدة البيانات
func handleGetUserProfile(c *fiber.Ctx) error {
	identifier := strings.TrimSpace(c.Query("identifier"))
	if identifier == "" {
		identifier = strings.TrimSpace(c.Query("user"))
	}

	var foundUser User

	// 1. البحث عبر query param
	if identifier != "" {
		DB.Where("LOWER(email) = ? OR id = ? OR LOWER(full_name) = ?",
			strings.ToLower(identifier), identifier, strings.ToLower(identifier)).First(&foundUser)
	}

	// 2. القراءة من Authorization Header إن لم يُعثر عليه
	if foundUser.ID == "" {
		authHeader := c.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if claims, err := parseToken(tokenStr); err == nil {
				if email, ok := claims["email"].(string); ok {
					DB.Where("email = ?", email).First(&foundUser)
				}
			}
		}
	}

	// 3. Fallback: جلب أول مستخدم متوفر
	if foundUser.ID == "" {
		DB.First(&foundUser)
	}

	if foundUser.ID == "" {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{
		"profile":      foundUser,
		"contents":     []interface{}{},
		"primaryColor": "#e056fd",
	})
}