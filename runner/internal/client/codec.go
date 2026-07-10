package client

import (
	"encoding/json"

	"google.golang.org/grpc/encoding"
)

// jsonCodec replaces the default protobuf codec with JSON encoding, mirroring
// api/internal/grpc/codec.go in the CollabReef API — both sides register a
// JSON codec under the name "proto" so the standard grpc content-type works
// without protoc-generated code. Keep the two files in sync.
type jsonCodec struct{}

func (jsonCodec) Marshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func (jsonCodec) Unmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

func (jsonCodec) Name() string {
	return "proto"
}

func init() {
	encoding.RegisterCodec(jsonCodec{})
}
