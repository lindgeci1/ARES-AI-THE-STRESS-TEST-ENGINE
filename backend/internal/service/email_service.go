package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

const sendGridAPIURL = "https://api.sendgrid.com/v3/mail/send"

// EmailService sends transactional emails through the SendGrid API.
type EmailService struct {
	apiKey string
	from   string
}

// NewEmailService creates an email service from SendGrid environment variables.
func NewEmailService() *EmailService {
	from := os.Getenv("SENDGRID_FROM_EMAIL")
	if from == "" {
		from = "noreply@ares-ai.dev"
	}

	return &EmailService{
		apiKey: os.Getenv("SENDGRID_API_KEY"),
		from:   from,
	}
}

type sendGridEmail struct {
	Email string `json:"email"`
}

type sendGridPersonalization struct {
	To []sendGridEmail `json:"to"`
}

type sendGridContent struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type sendGridMailRequest struct {
	Personalizations []sendGridPersonalization `json:"personalizations"`
	From             sendGridEmail              `json:"from"`
	Subject          string                     `json:"subject"`
	Content          []sendGridContent          `json:"content"`
}

func (s *EmailService) send(toEmail, subject, htmlBody string) error {
	if s.apiKey == "" || s.from == "" {
		return fmt.Errorf("sendgrid configuration is incomplete")
	}

	payload := sendGridMailRequest{
		Personalizations: []sendGridPersonalization{{To: []sendGridEmail{{Email: toEmail}}}},
		From:             sendGridEmail{Email: s.from},
		Subject:          subject,
		Content:          []sendGridContent{{Type: "text/html", Value: htmlBody}},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encode sendgrid request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, sendGridAPIURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build sendgrid request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("send sendgrid request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sendgrid request failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// SendResetCode sends a password reset code email.
func (s *EmailService) SendResetCode(toEmail string, code string) error {
	subject := "ARES AI — Password Reset Code"
	htmlBody := buildResetCodeEmail(code)

	if err := s.send(toEmail, subject, htmlBody); err != nil {
		return fmt.Errorf("send reset code email: %w", err)
	}

	return nil
}

// SendTempUserCredentials sends temp access credentials via SendGrid.
func (s *EmailService) SendTempUserCredentials(toEmail, operatorName, accessKey, expiresAt string) error {
	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		appURL = "http://localhost:5173"
	}

	subject := "ARES AI — Your Temporary Access Credentials"
	htmlBody := buildTempUserEmail(operatorName, toEmail, accessKey, expiresAt, appURL)

	if err := s.send(toEmail, subject, htmlBody); err != nil {
		return fmt.Errorf("send temp user credentials email: %w", err)
	}

	return nil
}

func buildEmailShell(title, bodyContent, footer string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#050505; font-family:'Courier New',monospace;">
	<table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#050505; padding:40px 0; border-collapse:collapse;">
		<tr>
			<td align="center">
				<table width="500" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; border:1px solid #262626; border-collapse:collapse;">
					<tr>
						<td style="padding:30px 40px 20px 40px; text-align:center; border-bottom:1px solid #262626;">
							<span style="color:#EF4444; font-size:14px; font-weight:bold; letter-spacing:4px;">ARES AI</span>
						</td>
					</tr>
					<tr>
						<td style="padding:25px 40px 10px 40px; text-align:center;">
							<span style="color:#ffffff; font-size:13px; font-weight:bold; letter-spacing:3px;">%s</span>
						</td>
					</tr>
					%s
					<tr>
						<td style="padding:15px 40px; text-align:center; border-top:1px solid #262626; background-color:#080808;">
							<span style="color:#333333; font-size:9px; letter-spacing:2px;">%s</span>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`, title, bodyContent, footer)
}

func buildResetCodeEmail(code string) string {
	bodyContent := fmt.Sprintf(`
					<tr>
						<td style="padding:10px 40px 20px 40px; text-align:center;">
							<span style="color:#666666; font-size:11px; letter-spacing:1px;">Your temporary password reset code is ready.</span>
						</td>
					</tr>
					<tr>
						<td style="padding:0 40px 10px 40px;">
							<table width="100%%" cellpadding="0" cellspacing="0" style="border:1px solid #EF4444; background-color:#111111; border-collapse:collapse;">
								<tr>
									<td style="padding:8px 15px;">
										<span style="color:#EF4444; font-size:9px; letter-spacing:2px;">RESET CODE</span>
									</td>
								</tr>
								<tr>
									<td style="padding:5px 15px 15px 15px; text-align:center;">
										<span style="color:#EF4444; font-size:34px; font-weight:bold; letter-spacing:8px;">%s</span>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr>
						<td style="padding:10px 40px 25px 40px; text-align:center;">
							<span style="color:#404040; font-size:10px; letter-spacing:1px;">This code expires in 5 minutes</span>
						</td>
					</tr>`, code)

	footer := "If you did not request this, ignore this email. - ARES AI STRESS-TEST ENGINE"
	return buildEmailShell("YOUR RESET CODE", bodyContent, footer)
}

func buildTempUserEmail(operatorName, toEmail, accessKey, expiresAt, appURL string) string {
	bodyContent := fmt.Sprintf(`
					<tr>
						<td style="padding:10px 40px 20px 40px; text-align:center;">
							<span style="color:#666666; font-size:11px; letter-spacing:1px;">Hello %s, your temporary access has been provisioned.</span>
						</td>
					</tr>
					<tr>
						<td style="padding:0 40px 10px 40px;">
							<table width="100%%" cellpadding="0" cellspacing="0" style="border:1px solid #EF4444; background-color:#111111; border-collapse:collapse;">
								<tr>
									<td style="padding:8px 15px;">
										<span style="color:#EF4444; font-size:9px; letter-spacing:2px;">ACCESS KEY</span>
									</td>
								</tr>
								<tr>
									<td style="padding:5px 15px 15px 15px; text-align:center;">
										<span style="color:#EF4444; font-size:22px; font-weight:bold; letter-spacing:3px;">%s</span>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr>
						<td style="padding:0 40px 10px 40px;">
							<table width="100%%" cellpadding="0" cellspacing="0" style="border:1px solid #262626; background-color:#111111; border-collapse:collapse;">
								<tr>
									<td style="padding:8px 15px;">
										<span style="color:#404040; font-size:9px; letter-spacing:2px;">EMAIL</span>
									</td>
								</tr>
								<tr>
									<td style="padding:5px 15px 15px 15px;">
										<span style="color:#ffffff; font-size:12px;">%s</span>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr>
						<td style="padding:10px 40px 25px 40px; text-align:center;">
							<span style="color:#404040; font-size:10px; letter-spacing:1px;">Expires: %s — Temporary access (3 audits maximum)</span>
						</td>
					</tr>
					<tr>
						<td style="padding:0 40px 25px 40px; text-align:center;">
							<span style="color:#666666; font-size:10px; letter-spacing:1px;">Login at: %s/auth</span>
						</td>
					</tr>`, operatorName, accessKey, toEmail, expiresAt, appURL)

	footer := "ARES AI — ENTERPRISE STRESS-TEST ENGINE"
	return buildEmailShell("YOUR ACCESS CREDENTIALS", bodyContent, footer)
}
