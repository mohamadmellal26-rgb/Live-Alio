package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// User Model المحدث ليدعم حقول اليوتيوبر والمستثمر
type User struct {
	ID             uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	FullName       string    `json:"fullName"`
	Email          string    `json:"email" gorm:"unique;index"`
	Password       string    `json:"-"`
	Role           string    `json:"role"`
	Avatar         string    `json:"avatar"`
	Bio            string    `json:"bio"`
	Location       string    `json:"location"`
	Website        string    `json:"website"`
	TargetIndustry string    `json:"targetIndustry"`
	YoutubeUrl     string    `json:"youtubeUrl"`   // خاص بدور Youtuber
	PyCardId       string    `json:"pyCardId"`     // خاص بدور Investor
	ProjectProof   string    `json:"projectProof"` // مسار ملف إثبات المشروع (PDF) للمستثمر
	Skills         []string  `json:"skills" gorm:"serializer:json"`
	FocusAreas     []string  `json:"focusAreas" gorm:"serializer:json"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
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
	claims := Claims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * 72)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// Helper to parse JWT Token
func parseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}

	return claims, nil
}

// Helper to save uploaded files (like Avatar and Project Proof)
func saveUploadedFile(c *fiber.Ctx, fieldName string) (string, error) {
	file, err := c.FormFile(fieldName)
	if err != nil {
		return "", nil
	}

	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		return "", err
	}

	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
	filePath := filepath.Join(uploadDir, filename)

	if err := c.SaveFile(file, filePath); err != nil {
		return "", err
	}

	return fmt.Sprintf("/uploads/%s", filename), nil
}

// Signup Handler المحدث
func handleSignup(c *fiber.Ctx) error {
	contentType := c.Get("Content-Type")

	var fullName, email, password, role, youtubeUrl, pyCardId string

	if strings.Contains(contentType, "application/json") {
		type RegisterInput struct {
			FullName   string `json:"fullName"`
			Email      string `json:"email"`
			Password   string `json:"password"`
			Role       string `json:"role"`
			YoutubeUrl string `json:"youtubeUrl"`
			PyCardId   string `json:"pyCardId"`
		}

		var input RegisterInput
		if err := c.BodyParser(&input); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
		}
		fullName = input.FullName
		email = input.Email
		password = input.Password
		role = input.Role
		youtubeUrl = input.YoutubeUrl
		pyCardId = input.PyCardId
	} else {
		fullName = c.FormValue("fullName")
		email = c.FormValue("email")
		password = c.FormValue("password")
		role = c.FormValue("role")
		youtubeUrl = c.FormValue("youtubeUrl")
		pyCardId = c.FormValue("pyCardId")
	}

	if role == "" {
		role = "user"
	}

	if strings.TrimSpace(fullName) == "" || strings.TrimSpace(email) == "" || strings.TrimSpace(password) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "All fields are required"})
	}

	var existingUser User
	if err := DB.Where("email = ?", strings.ToLower(email)).First(&existingUser).Error; err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Email already registered"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	newUser := User{
		FullName:   fullName,
		Email:      strings.ToLower(email),
		Password:   string(hashedPassword),
		Role:       role,
		YoutubeUrl: youtubeUrl,
		PyCardId:   pyCardId,
	}

	if !strings.Contains(contentType, "application/json") {
		if avatarPath, err := saveUploadedFile(c, "avatar"); err == nil && avatarPath != "" {
			newUser.Avatar = avatarPath
		}
		if proofPath, err := saveUploadedFile(c, "projectProof"); err == nil && proofPath != "" {
			newUser.ProjectProof = proofPath
		}
	}

	if err := DB.Create(&newUser).Error; err != nil {
		log.Printf("Signup Error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user: " + err.Error()})
	}

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

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid email or password"})
	}

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

// Get Current User Profile Handler (Private)
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

	var user User
	if err := DB.Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(user)
}

// Get Public User Profile by ID or Username (Public Endpoint)
func handleGetUserByID(c *fiber.Ctx) error {
	identifier := c.Params("id")
	if identifier == "" {
		identifier = c.Params("username")
	}

	if identifier == "" {
		return c.Status(400).JSON(fiber.Map{"error": "User ID or Username is required"})
	}

	var user User
	// البحث سواء حسب المعرف الرقمي أو البريد أو الاسم
	if err := DB.Where("id = ? OR LOWER(email) = ?", identifier, strings.ToLower(identifier)).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	user.Password = "" // إخفاء كلمة المرور للعامة

	return c.JSON(fiber.Map{
		"user": user,
	})
}

// Update User Profile Handler المحدث
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

	var user User
	if err := DB.Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	contentType := c.Get("Content-Type")

	if strings.Contains(contentType, "application/json") {
		type UpdateProfileJSON struct {
			FullName       string   `json:"fullName"`
			Role           string   `json:"role"`
			Bio            string   `json:"bio"`
			Location       string   `json:"location"`
			Website        string   `json:"website"`
			TargetIndustry string   `json:"targetIndustry"`
			YoutubeUrl     string   `json:"youtubeUrl"`
			PyCardId       string   `json:"pyCardId"`
			Skills         []string `json:"skills"`
			FocusAreas     []string `json:"focusAreas"`
		}

		var jsonReq UpdateProfileJSON
		if err := c.BodyParser(&jsonReq); err == nil {
			if jsonReq.FullName != "" {
				user.FullName = jsonReq.FullName
			}
			if jsonReq.Role != "" {
				user.Role = jsonReq.Role
			}
			if jsonReq.Bio != "" {
				user.Bio = jsonReq.Bio
			}
			if jsonReq.Location != "" {
				user.Location = jsonReq.Location
			}
			if jsonReq.Website != "" {
				user.Website = jsonReq.Website
			}
			if jsonReq.TargetIndustry != "" {
				user.TargetIndustry = jsonReq.TargetIndustry
			}
			if jsonReq.YoutubeUrl != "" {
				user.YoutubeUrl = jsonReq.YoutubeUrl
			}
			if jsonReq.PyCardId != "" {
				user.PyCardId = jsonReq.PyCardId
			}
			if len(jsonReq.Skills) > 0 {
				user.Skills = jsonReq.Skills
			}
			if len(jsonReq.FocusAreas) > 0 {
				user.FocusAreas = jsonReq.FocusAreas
			}
		}
	} else {
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
		if youtubeUrl := c.FormValue("youtubeUrl"); youtubeUrl != "" {
			user.YoutubeUrl = youtubeUrl
		}
		if pyCardId := c.FormValue("pyCardId"); pyCardId != "" {
			user.PyCardId = pyCardId
		}
	}

	if avatarPath, err := saveUploadedFile(c, "avatar"); err == nil && avatarPath != "" {
		user.Avatar = avatarPath
	}

	if proofPath, err := saveUploadedFile(c, "projectProof"); err == nil && proofPath != "" {
		user.ProjectProof = proofPath
	}

	if err := DB.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update profile"})
	}

	return c.JSON(fiber.Map{
		"message": "Profile updated successfully",
		"user":    user,
	})
}