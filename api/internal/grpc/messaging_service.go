package grpcserver

import (
	"context"
	"errors"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"gorm.io/gorm"

	"github.com/notomate/notomate/internal/db"
	"github.com/notomate/notomate/internal/model"
	"github.com/notomate/notomate/internal/util"
	"github.com/notomate/notomate/internal/workflow"
)

// ---------- Request / Response types (JSON-serialized) ----------

type GetChannelRequest struct {
	ID string `json:"id"`
}
type GetChannelResponse struct {
	Found       bool   `json:"found"`
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	Name        string `json:"name"`
}

type CreateMessageRequest struct {
	WorkspaceID string `json:"workspace_id"`
	ChannelID   string `json:"channel_id"`
	Body        string `json:"body"`
	UserID      string `json:"user_id"`
}
type CreateMessageResponse struct {
	ID                 string `json:"id"`
	ChannelID          string `json:"channel_id"`
	Body               string `json:"body"`
	Edited             bool   `json:"edited"`
	CreatedAt          string `json:"created_at"`
	CreatedBy          string `json:"created_by"`
	CreatedByName      string `json:"created_by_name"`
	CreatedByAvatarUrl string `json:"created_by_avatar_url"`
	UpdatedAt          string `json:"updated_at"`
}

type UpdateMessageRequest struct {
	WorkspaceID string `json:"workspace_id"`
	ChannelID   string `json:"channel_id"`
	MessageID   string `json:"message_id"`
	Body        string `json:"body"`
	UserID      string `json:"user_id"`
}
type UpdateMessageResponse struct {
	ID                 string `json:"id"`
	ChannelID          string `json:"channel_id"`
	Body               string `json:"body"`
	Edited             bool   `json:"edited"`
	CreatedAt          string `json:"created_at"`
	CreatedBy          string `json:"created_by"`
	CreatedByName      string `json:"created_by_name"`
	CreatedByAvatarUrl string `json:"created_by_avatar_url"`
	UpdatedAt          string `json:"updated_at"`
}

type NotifyRoomCreatedRequest struct {
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id"`
}
type NotifyRoomCreatedResponse struct{}

type NotifyClientConnectedRequest struct {
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id"`
}
type NotifyClientConnectedResponse struct{}

type NotifyClientDisconnectedRequest struct {
	ChannelID string `json:"channel_id"`
	UserID    string `json:"user_id"`
}
type NotifyClientDisconnectedResponse struct{}

// ---------- Service interface ----------

type MessagingServiceServer interface {
	GetUser(ctx context.Context, req *GetUserRequest) (*GetUserResponse, error)
	ValidateAPIKey(ctx context.Context, req *ValidateAPIKeyRequest) (*ValidateAPIKeyResponse, error)
	IsWorkspaceMember(ctx context.Context, req *IsWorkspaceMemberRequest) (*IsWorkspaceMemberResponse, error)
	GetChannel(ctx context.Context, req *GetChannelRequest) (*GetChannelResponse, error)
	CreateMessage(ctx context.Context, req *CreateMessageRequest) (*CreateMessageResponse, error)
	UpdateMessage(ctx context.Context, req *UpdateMessageRequest) (*UpdateMessageResponse, error)
	NotifyRoomCreated(ctx context.Context, req *NotifyRoomCreatedRequest) (*NotifyRoomCreatedResponse, error)
	NotifyClientConnected(ctx context.Context, req *NotifyClientConnectedRequest) (*NotifyClientConnectedResponse, error)
	NotifyClientDisconnected(ctx context.Context, req *NotifyClientDisconnectedRequest) (*NotifyClientDisconnectedResponse, error)
}

// ---------- Service descriptor ----------

func registerMessagingServiceServer(s *grpc.Server, srv MessagingServiceServer) {
	desc := grpc.ServiceDesc{
		ServiceName: "messaging.MessagingService",
		HandlerType: (*MessagingServiceServer)(nil),
		Methods: []grpc.MethodDesc{
			makeHandler("/messaging.MessagingService/GetUser", func(ctx context.Context, req *GetUserRequest) (interface{}, error) {
				return srv.GetUser(ctx, req)
			}),
			makeHandler("/messaging.MessagingService/ValidateAPIKey", func(ctx context.Context, req *ValidateAPIKeyRequest) (interface{}, error) {
				return srv.ValidateAPIKey(ctx, req)
			}),
			makeHandler("/messaging.MessagingService/IsWorkspaceMember", func(ctx context.Context, req *IsWorkspaceMemberRequest) (interface{}, error) {
				return srv.IsWorkspaceMember(ctx, req)
			}),
			makeHandler("/messaging.MessagingService/GetChannel", func(ctx context.Context, req *GetChannelRequest) (interface{}, error) {
				return srv.GetChannel(ctx, req)
			}),
			makeHandler("/messaging.MessagingService/CreateMessage", func(ctx context.Context, req *CreateMessageRequest) (interface{}, error) {
				return srv.CreateMessage(ctx, req)
			}),
			makeHandler("/messaging.MessagingService/UpdateMessage", func(ctx context.Context, req *UpdateMessageRequest) (interface{}, error) {
				return srv.UpdateMessage(ctx, req)
			}),
			makeHandler("/messaging.MessagingService/NotifyRoomCreated", func(ctx context.Context, req *NotifyRoomCreatedRequest) (interface{}, error) {
				return srv.NotifyRoomCreated(ctx, req)
			}),
			makeHandler("/messaging.MessagingService/NotifyClientConnected", func(ctx context.Context, req *NotifyClientConnectedRequest) (interface{}, error) {
				return srv.NotifyClientConnected(ctx, req)
			}),
			makeHandler("/messaging.MessagingService/NotifyClientDisconnected", func(ctx context.Context, req *NotifyClientDisconnectedRequest) (interface{}, error) {
				return srv.NotifyClientDisconnected(ctx, req)
			}),
		},
		Streams:  []grpc.StreamDesc{},
		Metadata: "messaging.proto",
	}
	s.RegisterService(&desc, srv)
}

// ---------- Implementation ----------

type messagingServer struct {
	db     db.DB
	engine *workflow.Engine
}

func (s *messagingServer) GetUser(ctx context.Context, req *GetUserRequest) (*GetUserResponse, error) {
	return doGetUser(s.db, req)
}

func (s *messagingServer) ValidateAPIKey(ctx context.Context, req *ValidateAPIKeyRequest) (*ValidateAPIKeyResponse, error) {
	return doValidateAPIKey(s.db, req)
}

func (s *messagingServer) IsWorkspaceMember(ctx context.Context, req *IsWorkspaceMemberRequest) (*IsWorkspaceMemberResponse, error) {
	return doIsWorkspaceMember(s.db, req)
}

func (s *messagingServer) GetChannel(ctx context.Context, req *GetChannelRequest) (*GetChannelResponse, error) {
	channel, err := s.db.FindChannel(model.Channel{ID: req.ID})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &GetChannelResponse{Found: false}, nil
		}
		return nil, status.Errorf(codes.Internal, "find channel: %v", err)
	}
	return &GetChannelResponse{
		Found:       true,
		ID:          channel.ID,
		WorkspaceID: channel.WorkspaceID,
		Name:        channel.Name,
	}, nil
}

// CreateMessage re-validates the channel/workspace/membership server-side
// rather than trusting the messaging service's join-time check, since a
// socket connection can outlive a user's workspace membership. It never
// pushes to the messaging service's /internal/broadcast endpoint — the
// messaging service is this method's only caller, and it broadcasts the
// returned message to the room itself immediately after this RPC returns.
// Calling the broadcast endpoint here too would double-deliver every
// socket-originated message.
func (s *messagingServer) CreateMessage(ctx context.Context, req *CreateMessageRequest) (*CreateMessageResponse, error) {
	channel, err := s.db.FindChannel(model.Channel{ID: req.ChannelID})
	if err != nil || channel.WorkspaceID != req.WorkspaceID {
		return nil, status.Errorf(codes.NotFound, "channel not found")
	}

	members, err := s.db.FindWorkspaceUsers(model.WorkspaceUserFilter{
		UserID:      req.UserID,
		WorkspaceID: req.WorkspaceID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "find workspace users: %v", err)
	}
	if len(members) == 0 {
		return nil, status.Errorf(codes.PermissionDenied, "not a workspace member")
	}

	if strings.TrimSpace(req.Body) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "body is required")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	message := model.Message{
		ID:          util.NewId(),
		WorkspaceID: req.WorkspaceID,
		ChannelID:   req.ChannelID,
		Body:        req.Body,
		CreatedAt:   now,
		CreatedBy:   req.UserID,
		UpdatedAt:   now,
		UpdatedBy:   req.UserID,
	}

	if err := s.db.CreateMessage(message); err != nil {
		return nil, status.Errorf(codes.Internal, "create message: %v", err)
	}

	if s.engine != nil {
		s.engine.NotifyMessageSent(message, req.UserID)
	}

	name, avatarUrl := req.UserID, ""
	if user, err := s.db.FindUserByID(req.UserID); err == nil {
		name, avatarUrl = user.Name, user.AvatarUrl
	}

	return &CreateMessageResponse{
		ID:                 message.ID,
		ChannelID:          message.ChannelID,
		Body:               message.Body,
		Edited:             message.Edited,
		CreatedAt:          message.CreatedAt,
		CreatedBy:          message.CreatedBy,
		CreatedByName:      name,
		CreatedByAvatarUrl: avatarUrl,
		UpdatedAt:          message.UpdatedAt,
	}, nil
}

// UpdateMessage re-validates ownership server-side rather than trusting the
// messaging service's join-time channel-membership check, mirroring the
// REST UpdateMessage handler: only the message's original author may edit
// it. Like CreateMessage, it never pushes to /internal/broadcast itself —
// the messaging service broadcasts the returned message to the room
// immediately after this RPC returns.
func (s *messagingServer) UpdateMessage(ctx context.Context, req *UpdateMessageRequest) (*UpdateMessageResponse, error) {
	existing, err := s.db.FindMessage(model.Message{ID: req.MessageID})
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "message not found")
	}
	if existing.ChannelID != req.ChannelID || existing.WorkspaceID != req.WorkspaceID {
		return nil, status.Errorf(codes.NotFound, "message not found")
	}
	if existing.CreatedBy != req.UserID {
		return nil, status.Errorf(codes.PermissionDenied, "you do not have permission to edit this message")
	}
	if strings.TrimSpace(req.Body) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "body is required")
	}

	existing.Body = req.Body
	existing.Edited = true
	existing.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	existing.UpdatedBy = req.UserID

	if err := s.db.UpdateMessage(existing); err != nil {
		return nil, status.Errorf(codes.Internal, "update message: %v", err)
	}

	name, avatarUrl := req.UserID, ""
	if user, err := s.db.FindUserByID(existing.CreatedBy); err == nil {
		name, avatarUrl = user.Name, user.AvatarUrl
	}

	return &UpdateMessageResponse{
		ID:                 existing.ID,
		ChannelID:          existing.ChannelID,
		Body:               existing.Body,
		Edited:             existing.Edited,
		CreatedAt:          existing.CreatedAt,
		CreatedBy:          existing.CreatedBy,
		CreatedByName:      name,
		CreatedByAvatarUrl: avatarUrl,
		UpdatedAt:          existing.UpdatedAt,
	}, nil
}

func (s *messagingServer) NotifyRoomCreated(ctx context.Context, req *NotifyRoomCreatedRequest) (*NotifyRoomCreatedResponse, error) {
	channel, err := s.db.FindChannel(model.Channel{ID: req.ChannelID})
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "channel not found")
	}
	if s.engine != nil {
		s.engine.NotifyRoomCreated(channel, req.UserID)
	}
	return &NotifyRoomCreatedResponse{}, nil
}

func (s *messagingServer) NotifyClientConnected(ctx context.Context, req *NotifyClientConnectedRequest) (*NotifyClientConnectedResponse, error) {
	channel, err := s.db.FindChannel(model.Channel{ID: req.ChannelID})
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "channel not found")
	}
	if s.engine != nil {
		s.engine.NotifyClientConnected(channel, req.UserID)
	}
	return &NotifyClientConnectedResponse{}, nil
}

func (s *messagingServer) NotifyClientDisconnected(ctx context.Context, req *NotifyClientDisconnectedRequest) (*NotifyClientDisconnectedResponse, error) {
	channel, err := s.db.FindChannel(model.Channel{ID: req.ChannelID})
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "channel not found")
	}
	if s.engine != nil {
		s.engine.NotifyClientDisconnected(channel, req.UserID)
	}
	return &NotifyClientDisconnectedResponse{}, nil
}
