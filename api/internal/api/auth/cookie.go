package auth

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/notomate/notomate/internal/config"
	"github.com/notomate/notomate/internal/model"

	"github.com/golang-jwt/jwt/v5"
)

func CreateUserCookie(u model.User) (*http.Cookie, error) {
	token := jwt.New(jwt.SigningMethodHS256)
	claims := token.Claims.(jwt.MapClaims)
	claims["id"] = u.ID

	claims["exp"] = time.Now().Add(time.Hour * 72).Unix()

	tokenString, err := token.SignedString([]byte(config.C.GetString(config.APP_SECRET)))
	if err != nil {
		return nil, err
	}

	cookie := new(http.Cookie)
	cookie.SameSite = http.SameSiteStrictMode
	cookie.Name = "token"
	cookie.Path = "/"
	cookie.Value = tokenString
	cookie.Expires = time.Now().Add(72 * time.Hour)

	return cookie, nil
}

func GetUserFromCookie(cookie *http.Cookie) (*model.User, error) {
	token, err := jwt.Parse(cookie.Value, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		return []byte(config.C.GetString(config.APP_SECRET)), nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("failed to parse token")
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		user := &model.User{
			ID: claims["id"].(string),
		}
		return user, nil
	}

	return nil, nil
}

func GetCleanCookie() *http.Cookie {

	cookie := new(http.Cookie)
	cookie.SameSite = http.SameSiteStrictMode
	cookie.Name = "token"
	cookie.Value = ""
	cookie.Path = "/"
	cookie.Expires = time.Now().Add(72 * time.Hour)

	return cookie
}
