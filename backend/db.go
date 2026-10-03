package main

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// تعريف المتغير العام DB ليكون متاحاً لجميع الملفات في package main مثل auth.go
var DB *gorm.DB

func InitDB() *gorm.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=postgres password=yourpassword dbname=live_aleo_db port=5432 sslmode=disable"
	}

	var err error
	// تعيين النتيجة للمتغير العام DB بدلاً من متغير محلي db
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}

	return DB
}