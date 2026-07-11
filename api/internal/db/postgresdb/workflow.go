package postgresdb

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/notomate/notomate/internal/model"
	"gorm.io/gorm"
)

func (s PostgresDB) CreateWorkflow(w model.Workflow) error {
	return gorm.G[model.Workflow](s.getDB()).Create(context.Background(), &w)
}

func (s PostgresDB) FindWorkflow(w model.Workflow) (model.Workflow, error) {
	return gorm.G[model.Workflow](s.getDB()).
		Where("id = ?", w.ID).
		Take(context.Background())
}

func (s PostgresDB) FindWorkflows(f model.WorkflowFilter) ([]model.Workflow, error) {
	query := gorm.G[model.Workflow](s.getDB())

	var conds []string
	var args []interface{}

	if f.WorkspaceID != "" {
		conds = append(conds, "workspace_id = ?")
		args = append(args, f.WorkspaceID)
	}
	if f.ID != "" {
		conds = append(conds, "id = ?")
		args = append(args, f.ID)
	}
	if f.Enabled != nil {
		conds = append(conds, "enabled = ?")
		args = append(args, *f.Enabled)
	}

	q := query.Where(strings.Join(conds, " AND "), args...).Order("created_at ASC")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize)
		if f.PageNumber > 1 {
			q = q.Offset((f.PageNumber - 1) * f.PageSize)
		}
	}

	return q.Find(context.Background())
}

func (s PostgresDB) UpdateWorkflow(w model.Workflow) error {
	_, err := gorm.G[model.Workflow](s.getDB()).
		Where("id = ?", w.ID).
		Select("name", "definition", "updated_at", "updated_by").
		Updates(context.Background(), w)

	return err
}

func (s PostgresDB) UpdateWorkflowEnabled(id string, enabled bool, updatedAt, updatedBy string) error {
	return s.getDB().
		Model(&model.Workflow{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"enabled":    enabled,
			"updated_at": updatedAt,
			"updated_by": updatedBy,
		}).Error
}

func (s PostgresDB) DeleteWorkflow(id string) error {
	_, err := gorm.G[model.Workflow](s.getDB()).
		Where("id = ?", id).
		Delete(context.Background())

	return err
}

func (s PostgresDB) CreateWorkflowRun(r model.WorkflowRun) error {
	return gorm.G[model.WorkflowRun](s.getDB()).Create(context.Background(), &r)
}

func (s PostgresDB) FindWorkflowRun(r model.WorkflowRun) (model.WorkflowRun, error) {
	return gorm.G[model.WorkflowRun](s.getDB()).
		Where("id = ?", r.ID).
		Take(context.Background())
}

func (s PostgresDB) FindWorkflowRuns(f model.WorkflowRunFilter) ([]model.WorkflowRun, error) {
	query := gorm.G[model.WorkflowRun](s.getDB())

	var conds []string
	var args []interface{}

	if f.WorkspaceID != "" {
		conds = append(conds, "workspace_id = ?")
		args = append(args, f.WorkspaceID)
	}
	if f.WorkflowID != "" {
		conds = append(conds, "workflow_id = ?")
		args = append(args, f.WorkflowID)
	}
	if f.ID != "" {
		conds = append(conds, "id = ?")
		args = append(args, f.ID)
	}
	if f.Status != "" {
		conds = append(conds, "status = ?")
		args = append(args, f.Status)
	}

	q := query.Where(strings.Join(conds, " AND "), args...).Order("created_at DESC")
	if f.PageSize > 0 {
		q = q.Limit(f.PageSize)
		if f.PageNumber > 1 {
			q = q.Offset((f.PageNumber - 1) * f.PageSize)
		}
	}

	return q.Find(context.Background())
}

func (s PostgresDB) UpdateWorkflowRunStatus(id string, status string, startedAt, finishedAt string) error {
	updates := map[string]interface{}{"status": status}
	if startedAt != "" {
		updates["started_at"] = startedAt
	}
	if finishedAt != "" {
		updates["finished_at"] = finishedAt
	}
	return s.getDB().
		Model(&model.WorkflowRun{}).
		Where("id = ?", id).
		Updates(updates).Error
}

func (s PostgresDB) NextWorkflowRunNumber(workflowID string) (int, error) {
	var next int
	err := s.getDB().
		Raw("SELECT COALESCE(MAX(run_number), 0) + 1 FROM workflow_runs WHERE workflow_id = ?", workflowID).
		Scan(&next).Error
	return next, err
}

func (s PostgresDB) DeleteWorkflowRunsBefore(createdBefore string) error {
	db := s.getDB()
	// Delete explicitly instead of relying on FK cascades, which sqlite may
	// not enforce depending on connection pragmas.
	if err := db.Exec(
		"DELETE FROM workflow_job_logs WHERE job_id IN (SELECT id FROM workflow_jobs WHERE run_id IN (SELECT id FROM workflow_runs WHERE created_at < ? AND status IN (?, ?, ?)))",
		createdBefore, model.WorkflowRunStatusSuccess, model.WorkflowRunStatusFailure, model.WorkflowRunStatusCancelled,
	).Error; err != nil {
		return err
	}
	if err := db.Exec(
		"DELETE FROM workflow_jobs WHERE run_id IN (SELECT id FROM workflow_runs WHERE created_at < ? AND status IN (?, ?, ?))",
		createdBefore, model.WorkflowRunStatusSuccess, model.WorkflowRunStatusFailure, model.WorkflowRunStatusCancelled,
	).Error; err != nil {
		return err
	}
	return db.Exec(
		"DELETE FROM workflow_runs WHERE created_at < ? AND status IN (?, ?, ?)",
		createdBefore, model.WorkflowRunStatusSuccess, model.WorkflowRunStatusFailure, model.WorkflowRunStatusCancelled,
	).Error
}

func (s PostgresDB) CreateWorkflowJob(j model.WorkflowJob) error {
	return gorm.G[model.WorkflowJob](s.getDB()).Create(context.Background(), &j)
}

func (s PostgresDB) FindWorkflowJob(j model.WorkflowJob) (model.WorkflowJob, error) {
	return gorm.G[model.WorkflowJob](s.getDB()).
		Where("id = ?", j.ID).
		Take(context.Background())
}

func (s PostgresDB) FindWorkflowJobs(f model.WorkflowJobFilter) ([]model.WorkflowJob, error) {
	query := gorm.G[model.WorkflowJob](s.getDB())

	var conds []string
	var args []interface{}

	if f.RunID != "" {
		conds = append(conds, "run_id = ?")
		args = append(args, f.RunID)
	}
	if f.ID != "" {
		conds = append(conds, "id = ?")
		args = append(args, f.ID)
	}
	if f.Status != "" {
		conds = append(conds, "status = ?")
		args = append(args, f.Status)
	}

	return query.
		Where(strings.Join(conds, " AND "), args...).
		Order("created_at ASC").
		Find(context.Background())
}

func (s PostgresDB) UpdateWorkflowJobStatus(id string, status string, startedAt, finishedAt string) error {
	updates := map[string]interface{}{"status": status}
	if startedAt != "" {
		updates["started_at"] = startedAt
	}
	if finishedAt != "" {
		updates["finished_at"] = finishedAt
	}
	return s.getDB().
		Model(&model.WorkflowJob{}).
		Where("id = ?", id).
		Updates(updates).Error
}

func (s PostgresDB) ClaimQueuedWorkflowJob(runnerID string, labels []string) (model.WorkflowJob, error) {
	return claimQueuedWorkflowJob(s.getDB(), runnerID, labels)
}

func (s PostgresDB) AppendWorkflowJobLogs(jobID string, startLine int, lines []string, createdAt string) error {
	return appendWorkflowJobLogs(s.getDB(), jobID, startLine, lines, createdAt)
}

func (s PostgresDB) FindWorkflowJobLogs(jobID string, afterLine int, limit int) ([]model.WorkflowJobLog, error) {
	q := gorm.G[model.WorkflowJobLog](s.getDB()).
		Where("job_id = ? AND line_no > ?", jobID, afterLine).
		Order("line_no ASC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	return q.Find(context.Background())
}

func (s PostgresDB) CountWorkflowJobLogs(jobID string) (int, error) {
	var count int64
	err := s.getDB().
		Model(&model.WorkflowJobLog{}).
		Where("job_id = ?", jobID).
		Count(&count).Error
	return int(count), err
}

// claimQueuedWorkflowJob picks the oldest queued job whose runs_on labels are
// all provided by the runner, and atomically marks it running. Callers are
// expected to serialize claims (the workflow queue holds an in-process mutex),
// but the conditional UPDATE keeps this safe against races regardless.
func claimQueuedWorkflowJob(db *gorm.DB, runnerID string, labels []string) (model.WorkflowJob, error) {
	labelSet := make(map[string]struct{}, len(labels))
	for _, l := range labels {
		labelSet[l] = struct{}{}
	}

	var jobs []model.WorkflowJob
	if err := db.
		Where("status = ?", model.WorkflowRunStatusQueued).
		Order("created_at ASC").
		Limit(50).
		Find(&jobs).Error; err != nil {
		return model.WorkflowJob{}, err
	}

	for _, job := range jobs {
		var runsOn []string
		if err := json.Unmarshal([]byte(job.RunsOn), &runsOn); err != nil {
			continue
		}
		matched := true
		for _, want := range runsOn {
			if _, ok := labelSet[want]; !ok {
				matched = false
				break
			}
		}
		if !matched {
			continue
		}

		startedAt := time.Now().UTC().Format(time.RFC3339)
		res := db.
			Model(&model.WorkflowJob{}).
			Where("id = ? AND status = ?", job.ID, model.WorkflowRunStatusQueued).
			Updates(map[string]interface{}{
				"status":     model.WorkflowRunStatusRunning,
				"runner_id":  runnerID,
				"started_at": startedAt,
			})
		if res.Error != nil {
			return model.WorkflowJob{}, res.Error
		}
		if res.RowsAffected == 1 {
			job.Status = model.WorkflowRunStatusRunning
			job.RunnerID = runnerID
			job.StartedAt = startedAt
			return job, nil
		}
	}

	return model.WorkflowJob{}, gorm.ErrRecordNotFound
}

func appendWorkflowJobLogs(db *gorm.DB, jobID string, startLine int, lines []string, createdAt string) error {
	if len(lines) == 0 {
		return nil
	}
	logs := make([]model.WorkflowJobLog, 0, len(lines))
	for i, line := range lines {
		logs = append(logs, model.WorkflowJobLog{
			JobID:     jobID,
			LineNo:    startLine + i,
			Content:   line,
			CreatedAt: createdAt,
		})
	}
	return db.CreateInBatches(&logs, 200).Error
}
