package model

type UserFilter struct {
	UserID      string
	Email       string
	NameOrEmail string
	Disabled    bool
}

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	PasswordHash string `json:"-"`
	Role         string `json:"role"`
	AvatarUrl    string `json:"avatar_url"`
	Disabled     bool   `json:"disabled"`
	CreatedBy    string `json:"created_by"`
	CreatedAt    string `json:"created_at"`
	UpdatedBy    string `json:"updated_by"`
	UpdatedAt    string `json:"updated_at"`
	Preferences  string `json:"preferences"`
}

const (
	RoleOwner = "owner"
	RoleAdmin = "admin"
	RoleUser  = "user"
)

var validRole = map[string]struct{}{
	RoleOwner: {},
	RoleAdmin: {},
	RoleUser:  {},
}

func IsValidRole(input string) bool {
	_, exists := validRole[input]
	return exists
}
