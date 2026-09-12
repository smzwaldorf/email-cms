// Generated from db/schema.sql by scripts/generate-sql-types.mjs.
export interface SqlTables {
  user_roles: {
    id: string
    email: string
    role: string
    created_at: string | null
    updated_at: string | null
    display_name: string | null
  }
  user_auth_identities: {
    issuer: string
    subject: string
    user_id: string
    created_at: string
  }
  analytics_events: {
    id: string
    user_id: string | null
    newsletter_id: string | null
    article_id: string | null
    session_id: string | null
    event_type: string
    metadata: Record<string, unknown> | null
    created_at: string | null
  }
  analytics_snapshots: {
    id: string
    snapshot_date: string
    newsletter_id: string | null
    article_id: string | null
    class_id: string | null
    metric_name: string
    metric_value: number | string
    created_at: string | null
  }
  article_audit_log: {
    id: string
    article_id: string
    action: string
    changed_by: string | null
    old_values: Record<string, unknown> | null
    new_values: Record<string, unknown> | null
    changed_at: string | null
  }
  article_categories: {
    id: string
    name: string
    description: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    deactivated_at: string | null
  }
  article_category_assignments: {
    article_id: string
    category_id: string
    assigned_at: string
  }
  article_media_references: {
    article_id: string
    media_id: string
    reference_type: "inline" | "embed" | "attachment"
    created_at: string
  }
  article_tag_assignments: {
    article_id: string
    tag_id: string
    assigned_at: string
  }
  article_tags: {
    id: string
    name: string
    description: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    deactivated_at: string | null
  }
  articles: {
    id: string
    title: string
    content: string
    author_id: string | null
    status: string | null
    visibility_type: string | null
    restricted_to_classes: Record<string, unknown> | null
    created_by: string | null
    created_at: string | null
    updated_at: string | null
    deleted_at: string | null
    short_id: string
    week_number: string | null
    author: string | null
    summary: string | null
    article_order: number | null
    class_ids: Array<string> | null
    family_ids: Array<string> | null
    published_at: string | null
    edited_at: string | null
    last_edited_by: string | null
    deleted_by: string | null
    purge_scheduled_at: string | null
  }
  auth_events: {
    id: string
    user_id: string | null
    event_type: string
    auth_method: string | null
    ip_address: string | null
    user_agent: string | null
    metadata: Record<string, unknown> | null
    created_at: string | null
  }
  authorization_decision_trace: {
    id: string
    actor_id: string | null
    action: string
    winning_role: string | null
    resolved_scope: Record<string, unknown>
    granted: boolean
    reason: string
    policy_version: string
    metadata: Record<string, unknown>
    created_at: string
  }
  class_audit_log: {
    id: string
    class_id: string
    action: string
    actor_id: string | null
    prior_state: Record<string, unknown> | null
    new_state: Record<string, unknown> | null
    changed_at: string
  }
  classes: {
    id: string
    class_name: string
    class_grade_year: number
    created_at: string | null
    class_code: string
    description: string | null
    is_active: boolean
    updated_at: string | null
    deactivated_at: string | null
  }
  email_platform_subscriber_mappings: {
    id: string
    family_id: string
    provider: "kit"
    external_identity_key: string
    external_subscriber_id: string | null
    external_email_address: string | null
    provider_state: string | null
    last_synced_at: string | null
    last_payload_fingerprint: string | null
    last_provider_version_marker: string | null
    last_reconciled_at: string | null
    last_drift_reason: string | null
    sync_metadata: Record<string, unknown>
    created_at: string
    updated_at: string
  }
  email_platform_subscription_audit: {
    id: string
    family_id: string
    provider: "kit"
    mapping_id: string | null
    webhook_event_id: string | null
    old_status: "pending" | "subscribed" | "unsubscribed" | "bounced" | "complained" | null
    new_status: "pending" | "subscribed" | "unsubscribed" | "bounced" | "complained"
    source: string
    event_type: string | null
    occurred_at: string | null
    metadata: Record<string, unknown>
    created_at: string
  }
  email_platform_sync_jobs: {
    id: string
    family_id: string | null
    mapping_id: string | null
    provider: "kit"
    job_type: string
    status: "pending" | "processing" | "retryable" | "succeeded" | "failed" | "dead_lettered"
    enqueue_reason: string
    payload: Record<string, unknown>
    payload_fingerprint: string | null
    attempt_count: number
    max_attempts: number
    next_retry_at: string
    processing_started_at: string | null
    completed_at: string | null
    dead_lettered_at: string | null
    mismatch_reason: string | null
    last_error_code: string | null
    last_error_message: string | null
    metrics: Record<string, unknown>
    created_at: string
    updated_at: string
  }
  email_platform_webhook_events: {
    id: string
    provider: "kit"
    provider_event_id: string
    event_type: string
    delivery_key: string
    signature_valid: boolean
    signature_failure_reason: string | null
    payload: Record<string, unknown>
    payload_hash: string
    occurred_at: string | null
    received_at: string
    status: "received" | "processing" | "retryable" | "processed" | "unresolved" | "failed" | "dead_lettered"
    attempt_count: number
    max_attempts: number
    next_retry_at: string
    processing_started_at: string | null
    processed_at: string | null
    dead_lettered_at: string | null
    resolved_family_id: string | null
    resolved_mapping_id: string | null
    unresolved_reason: string | null
    last_error_code: string | null
    last_error_message: string | null
    metrics: Record<string, unknown>
    created_at: string
    updated_at: string
  }
  email_template_revisions: {
    id: string
    template_id: string
    revision_number: number
    subject_template: string
    body_template: string
    created_by: string | null
    created_at: string
    blocks: Record<string, unknown>
  }
  email_templates: {
    id: string
    name: string
    description: string | null
    state: string
    current_revision_id: string | null
    deactivated_at: string | null
    created_at: string
    updated_at: string
  }
  families: {
    id: string
    family_code: string
    created_at: string | null
    family_name: string | null
    guardian_email: string | null
    description: string | null
    related_topics: Record<string, unknown>
    is_active: boolean
    updated_at: string
    deactivated_at: string | null
    newsletter_subscription_status: "pending" | "subscribed" | "unsubscribed" | "bounced" | "complained"
    newsletter_subscription_source: string | null
    newsletter_subscription_updated_at: string | null
    newsletter_subscribed_at: string | null
    newsletter_unsubscribed_at: string | null
  }
  family_audit_log: {
    id: string
    family_id: string
    action: string
    actor_id: string | null
    prior_state: Record<string, unknown> | null
    new_state: Record<string, unknown> | null
    changed_at: string
  }
  family_enrollment: {
    id: string
    family_id: string
    parent_id: string | null
    relationship: string
    enrolled_at: string | null
    student_id: string | null
  }
  media_deletion_audit: {
    id: string
    media_id: string
    deleted_by: string | null
    deleted_at: string
    reason: string
    preflight_usage_count: number
    metadata: Record<string, unknown>
  }
  media_files: {
    id: string
    filename: string
    file_type: "image" | "audio" | "video" | "document"
    mime_type: string
    file_size: number | string
    storage_path: string
    storage_provider: "supabase" | "s3"
    public_url: string
    width: number | null
    height: number | null
    alt_text: string | null
    caption: string | null
    duration: number | string | null
    usage_count: number
    referenced_articles: Array<string>
    uploaded_by: string
    uploaded_at: string
    updated_at: string
  }
  media_usage: {
    id: string
    media_id: string
    target_type: string
    target_id: string
    context_key: string
    active: boolean
    created_by: string | null
    created_at: string
    updated_at: string
    deactivated_at: string | null
  }
  media_variants: {
    id: string
    media_id: string
    variant_type: "original" | "thumbnail" | "webp" | "audio_optimized"
    format: string
    storage_path: string | null
    file_size: number | string | null
    width: number
    height: number
    duration: number | string | null
    status: "pending" | "processing" | "ready" | "failed"
    retry_count: number
    error_message: string | null
    last_processed_at: string | null
    created_at: string
    updated_at: string
  }
  newsletter_articles: {
    id: string
    newsletter_id: string
    article_id: string
    article_order: number
    added_at: string | null
    added_by: string | null
    targeting_mode: string
    target_class_ids: Array<string>
  }
  newsletter_delivery_batch_recipients: {
    id: string
    batch_id: string
    family_id: string
    guardian_email: string | null
    eligibility_status: "eligible" | "ineligible"
    preparation_status: "pending" | "ready" | "warning" | "failed" | "skipped"
    send_status: "pending" | "handoff_pending" | "sent" | "failed" | "skipped"
    failure_reason: string | null
    prepared_payload: Record<string, unknown> | null
    provider_message_id: string | null
    provider_error: string | null
    last_attempted_at: string | null
    sent_at: string | null
    created_at: string
    updated_at: string
    parent_id: string | null
    parent_email: string | null
    journey_correlation_id: string
    preparation_findings: Record<string, unknown>
    kit_merge_sync_status: string
    kit_merge_payload: Record<string, unknown> | null
    kit_merge_payload_fingerprint: string | null
    kit_merge_provider_field_ids: Record<string, unknown>
    kit_merge_last_synced_at: string | null
    kit_merge_provider_error: string | null
    campaign_ready: boolean
  }
  newsletter_delivery_batches: {
    id: string
    newsletter_id: string
    trigger: "publish" | "resend"
    audience_mode: "all" | "classes" | "families" | "family"
    selected_class_ids: Array<string>
    selected_family_ids: Array<string>
    parent_batch_id: string | null
    state: "queued" | "preparing" | "sending" | "completed" | "completed_with_failures" | "failed"
    pinned_newsletter_revision_id: string
    pinned_template_id: string | null
    pinned_template_revision_id: string | null
    recipient_snapshot_captured_at: string
    rules_version: string
    preparation_job_id: string | null
    total_recipients: number
    eligible_recipients: number
    ready_recipients: number
    sent_recipients: number
    failed_recipients: number
    invalid_recipients: number
    metadata: Record<string, unknown>
    created_by: string | null
    created_at: string
    updated_at: string
  }
  newsletter_delivery_jobs: {
    id: string
    batch_id: string
    job_type: string
    status: string
    attempts: number
    max_attempts: number
    run_after: string
    locked_at: string | null
    locked_by: string | null
    started_at: string | null
    completed_at: string | null
    last_error: string | null
    details: Record<string, unknown>
    created_at: string
    updated_at: string
  }
  newsletters: {
    id: string
    week_number: string | null
    title: string | null
    description: string | null
    release_date: string
    status: string | null
    published_at: string | null
    created_at: string | null
    updated_at: string | null
    is_template: boolean
  }
  permission_mutation_audit_log: {
    id: string
    actor_id: string | null
    target_user_id: string
    action: string
    before_state: Record<string, unknown>
    after_state: Record<string, unknown>
    metadata: Record<string, unknown>
    changed_at: string
  }
  student_audit_log: {
    id: string
    student_id: string
    action: string
    actor_id: string | null
    prior_state: Record<string, unknown> | null
    new_state: Record<string, unknown> | null
    changed_at: string
  }
  student_class_enrollment: {
    id: string
    student_id: string
    family_id: string
    class_id: string
    enrolled_at: string | null
    graduated_at: string | null
  }
  students: {
    id: string
    name: string
    created_at: string | null
    updated_at: string | null
    student_code: string
    is_active: boolean
    deactivated_at: string | null
  }
  teacher_audit_log: {
    id: string
    teacher_id: string
    action: string
    actor_id: string | null
    prior_state: Record<string, unknown> | null
    new_state: Record<string, unknown> | null
    changed_at: string
  }
  teacher_class_assignment: {
    id: string
    teacher_id: string
    class_id: string
    assigned_at: string | null
  }
  teacher_profiles: {
    user_id: string
    display_name: string
    status: string
    is_active: boolean
    deactivated_at: string | null
    created_at: string
    updated_at: string
  }
  tracking_tokens: {
    id: string
    user_id: string | null
    token_hash: string
    token_payload: Record<string, unknown>
    is_revoked: boolean | null
    expires_at: string
    created_at: string | null
  }
  user_role_assignments: {
    id: string
    user_id: string
    role: string
    created_at: string
    updated_at: string
  }
}
