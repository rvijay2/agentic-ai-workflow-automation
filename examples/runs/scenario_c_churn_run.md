# Customer Churn Investigation Report
**Run ID:** bfe52c8d-9e9f-4b01-8c05-595816b255a4
**Request:** Customer churn investigation: profile CSV data, detect anomalies, find policy snippets, produce action plan
**Status:** running
**Date:** 2026-04-07T16:42:35.190Z

## Executive Summary
Completed 5/5 steps successfully.

## Step Results
### ✅ step_1 — csv_profile
- Duration: 1ms | Retries: 0
- Summary: CSV Profile: customers.csv
Rows: 15, Columns: 9
Numeric columns: monthly_revenue (mean=7276.6667, σ=6430.2117); tenure_months (mean=17.8, σ=12.2213); nps_score (mean=6.2, σ=2.0396); support_tickets (mean=5.5333, σ=5.4634); days_since_login (mean=40.7333, σ=44.9228); usage_score (mean=0.624, σ=0.3225); churn_risk_score (mean=0.4667, σ=0.3545)
Total anomalies detected (|Z| > 2.5): 0
### ✅ step_2 — doc_search
- Duration: 2ms | Retries: 0
```json
{
  "results": [
    {
      "file": "customer_retention_policy.md",
      "content": "# Customer Retention and Churn Reduction Policy ## Churn Risk Indicators Customers are classified as high churn risk when: - Monthly usage drops by more than 30% for 2 consecutive months - Support tickets increase to more than 5 per month - NPS score drops below 6 - Last login was more than 45 days ago - Payment failures occur more than twice ## Retention Actions by Tier ### Tier 1 (Enterprise, > $10,000/month
```
### ✅ step_3 — doc_qa
- Duration: 1ms | Retries: 0
- Answer: Based on the documents: # Customer Retention and Churn Reduction Policy ## Churn Risk Indicators Customers are classified as high churn risk when: - Monthly usage drops by more than 30% for 2 consecutive months - Support tickets increase to more than 5 per month - NPS score drops below 6 - Last login was more than 45 days ago - Payment failures occur more than twice ## Retention Actions by Tier ### Tier 1 (Enterprise, > $10,000/month) - Immediate outreach by Customer Success Manager within 24 hours | - Self-serve success resources ## Escalation Path 1  Identify churn risk (automated scoring daily) 2  Assign to Customer Success Manager 3  Log outreach attempt in CRM 4  Escalate to Director of Customer Success after 7 days without response ## Win-Back Program For churned customers: 30-day free trial extension + 25% discount | # Customer Retention and Churn Reduction Policy
### ✅ step_4 — json_schema_infer
- Duration: 1ms | Retries: 0
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "segments": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "criteria": {
              "type": "object",
              "properties": {
                "minMonthlyRevenue": {
                  "type": "number"
                },
         
```
### ✅ step_5 — workflow_dsl_compile
- Duration: 4ms | Retries: 0
```json
{
  "def": {
    "name": "customer-churn-intervention",
    "version": "1.0",
    "description": "Automated customer churn detection and intervention workflow",
    "inputs": {
      "csv_file": {
        "type": "string",
        "default": "examples/data/customers.csv"
      },
      "z_score_threshold": {
        "type": "number",
        "default": 2
      }
    },
    "steps": [
      {
        "id": "profile_csv",
        "name": "Profile Customer Data",
        "tool": "csv_profile",
    
```

## Data Profile
```
CSV Profile: customers.csv
Rows: 15, Columns: 9
Numeric columns: monthly_revenue (mean=7276.6667, σ=6430.2117); tenure_months (mean=17.8, σ=12.2213); nps_score (mean=6.2, σ=2.0396); support_tickets (mean=5.5333, σ=5.4634); days_since_login (mean=40.7333, σ=44.9228); usage_score (mean=0.624, σ=0.3225); churn_risk_score (mean=0.4667, σ=0.3545)
Total anomalies detected (|Z| > 2.5): 0
```

## Key Findings (from Documents)
> Based on the documents: # Customer Retention and Churn Reduction Policy ## Churn Risk Indicators Customers are classified as high churn risk when: - Monthly usage drops by more than 30% for 2 consecutive months - Support tickets increase to more than 5 per month - NPS score drops below 6 - Last login was more than 45 days ago - Payment failures occur more than twice ## Retention Actions by Tier ### Tier 1 (Enterprise, > $10,000/month) - Immediate outreach by Customer Success Manager within 24 hours | - Self-serve success resources ## Escalation Path 1  Identify churn risk (automated scoring daily) 2  Assign to Customer Success Manager 3  Log outreach attempt in CRM 4  Escalate to Director of Customer Success after 7 days without response ## Win-Back Program For churned customers: 30-day free trial extension + 25% discount | # Customer Retention and Churn Reduction Policy

## Workflow Plan
**Workflow:** customer-churn-intervention
**Execution Order:** profile_csv → search_retention → qa_policies → validate_segments → render_action_plan
**Valid:** true

## Citations
*All findings are grounded in the following sources:*

[1] **customers.csv**: CSV Profile: customers.csv Rows: 15, Columns: 9 Numeric columns: monthly_revenue (mean=7276.6667, σ=6430.2117); tenure_months (mean=17.8, σ=12.2213); 
[2] **customer_retention_policy.md**: # Customer Retention and Churn Reduction Policy ## Churn Risk Indicators Customers are classified as high churn risk when: - Monthly usage drops by mo
[3] **customer_retention_policy.md**: - Self-serve success resources ## Escalation Path 1  Identify churn risk (automated scoring daily) 2  Assign to Customer Success Manager 3  Log outrea
[4] **customer_retention_policy.md**: - Executive Sponsor call within 72 hours - Custom success plan with 90-day milestones - Discount up to 20% for 6-month commitment renewal ### Tier 2 (
[5] **security_policy.md**: Preserve all logs and evidence 4  Do not attempt to remediate without Security Team approval ## Remote Work Policy - Always use company VPN when acces
[6] **onboarding_policy.md**: # New Hire Onboarding Policy ## Overview All new employees must complete onboarding within the first 14 days of joining ## Required Steps 1  Submit si
[7] **doc_qa_snippet_1**: # Customer Retention and Churn Reduction Policy ## Churn Risk Indicators Customers are classified as high churn risk when: - Monthly usage drops by mo
[8] **doc_qa_snippet_2**: - Self-serve success resources ## Escalation Path 1  Identify churn risk (automated scoring daily) 2  Assign to Customer Success Manager 3  Log outrea
[9] **doc_qa_snippet_3**: # Customer Retention and Churn Reduction Policy
[10] **customer_segments.json**: Schema inferred: {"type":"object","properties":{"segments":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"name":{"type
