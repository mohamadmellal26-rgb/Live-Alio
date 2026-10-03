package main

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// هيكل المستخدم (User Model) المدعوم لكافة البيانات الشخصية
type User struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	FullName       string         `json:"fullName"`
	Email          string         `gorm:"unique;not null" json:"email"`
	Password       string         `json:"-"` // لا يتم إرجاع كلمة المرور في الـ JSON
	Role           string         `json:"role"`
	Bio            string         `json:"bio"`
	Location       string         `json:"location"`
	Website        string         `json:"website"`
	TargetIndustry string         `json:"targetIndustry"`
	Avatar         string         `json:"avatar"`
	
	// استخدام Serializer لجعل GORM يخزن المصفوفات (Slices) كـ JSON في بوستجريس
	Skills         []string       `gorm:"serializer:json" json:"skills"`
	FocusAreas     []string       `gorm:"serializer:json" json:"focusAreas"`
	
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

// تعريف المتغير العام DB ليكون متاحاً لجميع الملفات في package main مثل auth.go
var DB *gorm.DB

func InitDB() *gorm.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=yourpassword dbname=live_aleo_db port=5432 sslmode=disable"
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}

	// الهجرة التلقائية لإنشاء أو تحديث جدول User وتوفير الأعمدة الجديدة تلقائياً
	err = DB.AutoMigrate(&User{})
	if err != nil {
		log.Fatalf("Failed to auto-migrate database schema: %v", err)
	}

	log.Println("Database connection established & schema migrated successfully.")
	return DB
}