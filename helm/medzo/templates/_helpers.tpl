{{/*
Expand the name of the chart.
*/}}
{{- define "medzo.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "medzo.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "medzo.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "medzo.labels" -}}
helm.sh/chart: {{ include "medzo.chart" . }}
{{ include "medzo.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ include "medzo.imageTag" . | trunc 63 | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "medzo.selectorLabels" -}}
app.kubernetes.io/name: {{ include "medzo.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "medzo.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "medzo.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Per-component labels. The chart runs three components (api, mongodb, redis),
so each selector also pins app.kubernetes.io/component.
*/}}
{{- define "medzo.componentSelectorLabels" -}}
{{ include "medzo.selectorLabels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{- define "medzo.componentLabels" -}}
{{ include "medzo.labels" .root }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Image tag: CI sets image.tag to the git SHA. Falls back to appVersion.
*/}}
{{- define "medzo.imageTag" -}}
{{- .Values.image.tag | default .Chart.AppVersion }}
{{- end }}

{{/*
Name of the Secret holding MONGODB_URI, JWT_SECRET, etc.
*/}}
{{- define "medzo.secretName" -}}
{{- .Values.secrets.existingSecret | default (printf "%s-secrets" (include "medzo.fullname" .)) }}
{{- end }}
