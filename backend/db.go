package main

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB يقوم بالاتصال بـ PostgreSQL وإنشاء الجداول تلقائياً (AutoMigrate)
func InitDB() {
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "5432"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "postgres_password"
	}
	dbname := os.Getenv("DB_NAME")
	if dbname == "" {
		dbname = "live_aleo_db"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		host, user, password, dbname, port)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}

	// هجرة الجدول تلقائياً تلقاء نموذج User
	err = db.AutoMigrate(&User{})
	if err != nil {
		log.Fatalf("Failed to migrate database schemas: %v", err)
	}

	DB = db
	log.Println("PostgreSQL database connected and migrated successfully!")
}