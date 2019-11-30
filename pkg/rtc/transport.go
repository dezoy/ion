package rtc

import (
	"github.com/pion/rtcp"
	"github.com/pion/rtp"
)

type Transport interface {
	ID() string
	readRTP() (*rtp.Packet, error)
	writeRTP(*rtp.Packet) error
	sendPLI()
	sendNack(*rtcp.TransportLayerNack)
	sendREMB(float64)
	sendRR()
	Close()
}
