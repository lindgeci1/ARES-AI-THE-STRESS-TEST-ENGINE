package service

import (
	"log"
	"sync"
)

// JobQueueService manages async audit jobs and notifies listeners when a job completes.
// Uses in-memory channels — no external dependencies required.
type JobQueueService struct {
	pipeline  *AuditPipelineService
	mu        sync.Mutex
	listeners map[uint][]chan string
}

func NewJobQueueService(pipeline *AuditPipelineService) *JobQueueService {
	return &JobQueueService{
		pipeline:  pipeline,
		listeners: make(map[uint][]chan string),
	}
}

// EnqueueAuditJob submits a document audit to run in the background.
// When it completes (success or failure) all SSE listeners for that document are notified.
func (j *JobQueueService) EnqueueAuditJob(documentID uint, round int) {
	go func() {
		err := j.pipeline.ProcessDocument(documentID, round)

		event := "done"
		if err != nil {
			log.Printf("JobQueue: pipeline error for document %d: %v", documentID, err)
			event = "failed"
		}

		j.notify(documentID, event)
	}()
}

// Subscribe returns a channel that receives one event string ("done" or "failed")
// when the job for documentID finishes. The caller must call Unsubscribe when done.
func (j *JobQueueService) Subscribe(documentID uint) chan string {
	ch := make(chan string, 1)
	j.mu.Lock()
	j.listeners[documentID] = append(j.listeners[documentID], ch)
	j.mu.Unlock()
	return ch
}

// Unsubscribe removes a channel from the listener list for a document.
func (j *JobQueueService) Unsubscribe(documentID uint, ch chan string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	list := j.listeners[documentID]
	for i, c := range list {
		if c == ch {
			j.listeners[documentID] = append(list[:i], list[i+1:]...)
			break
		}
	}
}

func (j *JobQueueService) notify(documentID uint, event string) {
	j.mu.Lock()
	list := j.listeners[documentID]
	delete(j.listeners, documentID)
	j.mu.Unlock()

	for _, ch := range list {
		ch <- event
		close(ch)
	}
}
