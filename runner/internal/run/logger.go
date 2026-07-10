package run

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/collabreef/collabreef-runner/internal/client"
)

const (
	logFlushInterval = time.Second
	logFlushBatch    = 50
)

// logStreamer buffers job log lines and flushes them to the server via
// UpdateLog. It also surfaces server-side cancellation: when an UpdateLog
// response carries Cancelled, the job context is cancelled.
type logStreamer struct {
	client *client.Client
	jobID  string
	cancel context.CancelFunc

	mu       sync.Mutex
	pending  []string
	nextLine int // line number of the first pending line (1-based)

	done chan struct{}
	wg   sync.WaitGroup
}

func newLogStreamer(c *client.Client, jobID string, cancel context.CancelFunc) *logStreamer {
	s := &logStreamer{
		client:   c,
		jobID:    jobID,
		cancel:   cancel,
		nextLine: 1,
		done:     make(chan struct{}),
	}
	s.wg.Add(1)
	go s.loop()
	return s
}

func (s *logStreamer) Append(line string) {
	s.mu.Lock()
	s.pending = append(s.pending, line)
	flushNow := len(s.pending) >= logFlushBatch
	s.mu.Unlock()
	if flushNow {
		s.flush()
	}
}

func (s *logStreamer) loop() {
	defer s.wg.Done()
	ticker := time.NewTicker(logFlushInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			s.flush()
		case <-s.done:
			return
		}
	}
}

func (s *logStreamer) flush() {
	s.mu.Lock()
	if len(s.pending) == 0 {
		s.mu.Unlock()
		return
	}
	lines := s.pending
	start := s.nextLine
	s.pending = nil
	s.nextLine += len(lines)
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	resp, err := s.client.UpdateLog(ctx, &client.UpdateLogRequest{
		JobID:     s.jobID,
		StartLine: start,
		Lines:     lines,
	})
	if err != nil {
		// Re-queue so a transient failure loses nothing; the server dedupes
		// overlapping retries by line number.
		s.mu.Lock()
		s.pending = append(lines, s.pending...)
		s.nextLine = start
		s.mu.Unlock()
		return
	}
	if resp.Cancelled {
		s.cancel()
	}
}

// Close flushes remaining lines and stops the background loop.
func (s *logStreamer) Close() {
	close(s.done)
	s.wg.Wait()
	s.flush()
}

// jobLoggerFactory adapts the streamer to act's runner.JobLoggerFactory.
type jobLoggerFactory struct {
	streamer *logStreamer
}

func (f *jobLoggerFactory) WithJobLogger() *logrus.Logger {
	logger := logrus.New()
	logger.SetLevel(logrus.InfoLevel)
	logger.SetFormatter(&lineFormatter{})
	logger.SetOutput(&streamWriter{streamer: f.streamer})
	return logger
}

// lineFormatter renders one plain log line per entry.
type lineFormatter struct{}

func (lineFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	msg := strings.TrimRight(entry.Message, "\n")
	prefix := ""
	if step, ok := entry.Data["stepID"]; ok {
		prefix = fmt.Sprintf("[%v] ", step)
	} else if job, ok := entry.Data["jobID"]; ok {
		prefix = fmt.Sprintf("[%v] ", job)
	}
	return []byte(fmt.Sprintf("%s %s%s\n", entry.Time.UTC().Format(time.RFC3339), prefix, msg)), nil
}

// streamWriter splits logger output into lines for the streamer.
type streamWriter struct {
	streamer *logStreamer
	buf      strings.Builder
}

func (w *streamWriter) Write(p []byte) (int, error) {
	w.buf.Write(p)
	for {
		s := w.buf.String()
		idx := strings.IndexByte(s, '\n')
		if idx < 0 {
			break
		}
		w.streamer.Append(s[:idx])
		w.buf.Reset()
		w.buf.WriteString(s[idx+1:])
	}
	return len(p), nil
}
