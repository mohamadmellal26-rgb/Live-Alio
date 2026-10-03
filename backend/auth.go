package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
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

// DB متغير الجلسة لقاعدة البيانات
var DB *gorm.DB

// User نموذج المستخدم في قاعدة البيانات
type User struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	FullName       string    `gorm:"not null" json:"fullName"`
	Email          string    `gorm:"uniqueIndex;not null" json:"email"`
	Password       string    `gorm:"not null" json:"-"`
	Role           string    `gorm:"default:'user'" json:"role"`
	Avatar         string    `json:"avatarUrl,omitempty"`
	Bio            string    `json:"bio,omitempty"`
	Location       string    `json:"location,omitempty"`
	Website        string    `json:"website,omitempty"`
	TargetIndustry string    `json:"targetIndustry,omitempty"`
	Skills         []string  `gorm:"serializer:json" json:"skills,omitempty"`
	FocusAreas     []string  `gorm:"serializer:json" json:"focusAreas,omitempty"`
	IsVerified     bool      `gorm:"default:true" json:"isVerified"`
	JoinedDate     string    `json:"joinedDate"`
	YoutubeUrl     string    `json:"youtubeUrl,omitempty"`
	PyCardId       string    `json:"pyCardId,omitempty"`
	ProjectProof   string    `json:"projectProof,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
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
		"userId":    user.ID,
		"email":     user.Email,
		"fullName":  user.FullName,
		"role":      user.Role,
		"avatarUrl": user.Avatar,
		"exp":       time.Now().Add(time.Hour * 72).Unix(),
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

	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		return "", err
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().UnixNano(), ext)
	savePath := filepath.Join(uploadDir, filename)

	if err := c.SaveFile(file, savePath); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}

// handleSignup لإنشاء حساب جديد وتخزينه في قاعدة البيانات
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

// handleLogin لتسجيل الدخول
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

// handleGetUserProfile لجلب البروفايل من قاعدة البيانات
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

// handleUpdateUserProfile لتحديث البيانات الشخصية وصورة الحساب
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

	userID, ok := claims["userId"].(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token payload"})
	}

	var user User
	if err := DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(4404).JSON(fiber.Map{"error": "User not found"})
	}

	// استخراج البيانات النصية المرسلة عبر FormData
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

	// معالجة مصفوفة Skills المرسلة كـ JSON String
	if skillsRaw := c.FormValue("skills"); skillsRaw != "" {
		var parsedSkills []string
		if err := json.Unmarshal([]byte(skillsRaw), &parsedSkills); err == nil {
			user.Skills = parsedSkills
		}
	}

	// معالجة مصفوفة FocusAreas المرسلة كـ JSON String
	if focusRaw := c.FormValue("focusAreas"); focusRaw != "" {
		var parsedFocus []string
		if err := json.Unmarshal([]byte(focusRaw), &parsedFocus); err == nil {
			user.FocusAreas = parsedFocus
		}
	}

	// حفظ الصورة الجديدة إن وُجدت
	if avatarPath, err := saveUploadedFile(c, "avatar"); err == nil && avatarPath != "" {
		user.Avatar = avatarPath
	}

	if err := DB.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update profile"})
	}

	return c.JSON(fiber.Map{
		"message": "Profile updated successfully",
		"user":    user,
	})
}