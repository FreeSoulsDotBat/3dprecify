# Runbook — UAT deploy (Precifica3D)

> Operational guide for deploying the app to the **uat** environment (Cloud Run + Firebase Hosting,
> `southamerica-east1`, WIF keyless — ADR-0005) and verifying/rolling back a deploy. Created by feature 006
> (T001 skeleton; content filled by T019). The completed FIRST run is recorded as DoD evidence in
> `specs/006-uat-deploy-hardening/dod-evidence.md`.

## 1. Config & prerequisites

_To be filled (T019): the GitHub `uat` Environment vars/secrets table (research §1.1) and the GCP/Firebase
resource inventory + least-privilege roles (research §1.2), with owner-gated markers._

## 2. Deploy

_To be filled (T019): trigger the `Deploy` workflow → environment `uat`, ref `develop`; record the run URL +
`github.sha`._

## 3. Smoke checklist (device-executable)

_To be filled (T019): the ordered checklist from data-model §3 + the correlation-id verification step
(analyze C1)._

## 4. Rollback & half-deploy triage

_To be filled (T019): per-half rollback (`gcloud run services update-traffic` · `firebase
hosting:rollback`) and how to triage which half moved (research §7)._
