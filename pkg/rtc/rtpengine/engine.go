package rtpengine

import (
	"net"

	"github.com/pion/ion/pkg/log"
	"github.com/pion/ion/pkg/rtc/rtpengine/udp"
)

func serve(port int) <-chan udp.Conn {
	log.Infof("UDP listening:%d", port)
	if listener != nil {
		listener.Close()
	}
	var err error
	listener, err = udp.Listen("udp", &net.UDPAddr{IP: net.IPv4zero, Port: port})
	if err != nil {
		log.Errorf("failed to listen %v", err)
		return nil
	}

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				log.Errorf("failed to accept conn %v", err)
				continue
			}
			log.Infof("accept new rtp conn %s", conn.RemoteAddr().String())
			return conn
			// go func() {
			// t := newRTPTransport(conn)
			// if t != nil {
			// t.receiveRTP()
			// }
			// pid := t.getPID()
			// cnt := 0
			// for pid == "" && cnt < 10 {
			// pid = t.getPID()
			// time.Sleep(time.Millisecond)
			// cnt++
			// }
			// if pid == "" && cnt >= 10 {
			// log.Infof("pid == \"\" && cnt >=10 return")
			// return
			// }
			// log.Infof("accept new rtp pid=%s conn=%s", pid, conn.RemoteAddr().String())
			// getOrNewPipeline(pid).addPub(pid, t)
			// }()
		}
	}()
	return nil
}
