{{/*
API pod template, shared by the Deployment and the Argo Rollout so both
release modes run exactly the same pod.
*/}}
{{- define "medzo.api.podTemplate" -}}
{{- $api := dict "root" . "component" "api" -}}
metadata:
  annotations:
    # Config or secret change -> new pod template -> pods restart and pick it up
    checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
    {{- if not .Values.secrets.existingSecret }}
    checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
    {{- end }}
    {{- with .Values.podAnnotations }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
  labels:
    {{- include "medzo.componentLabels" $api | nindent 4 }}
    {{- with .Values.podLabels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
spec:
  {{- with .Values.imagePullSecrets }}
  imagePullSecrets:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  serviceAccountName: {{ include "medzo.serviceAccountName" . }}
  automountServiceAccountToken: false
  terminationGracePeriodSeconds: {{ .Values.terminationGracePeriodSeconds }}
  securityContext:
    {{- toYaml .Values.podSecurityContext | nindent 4 }}
  {{- if .Values.topologySpread.enabled }}
  topologySpreadConstraints:
    - maxSkew: {{ .Values.topologySpread.maxSkew }}
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: {{ .Values.topologySpread.whenUnsatisfiable }}
      labelSelector:
        matchLabels:
          {{- include "medzo.componentSelectorLabels" $api | nindent 10 }}
  {{- end }}
  containers:
    - name: api
      securityContext:
        {{- toYaml .Values.securityContext | nindent 8 }}
      image: "{{ .Values.image.repository }}:{{ include "medzo.imageTag" . }}"
      imagePullPolicy: {{ .Values.image.pullPolicy }}
      ports:
        - name: http
          containerPort: {{ .Values.service.port }}
          protocol: TCP
      envFrom:
        - configMapRef:
            name: {{ include "medzo.fullname" . }}-config
      env:
        - name: APP_VERSION
          value: {{ include "medzo.imageTag" . | quote }}
        - name: POD_NAME
          valueFrom: { fieldRef: { fieldPath: metadata.name } }
        {{- range $key := list "MONGODB_URI" "JWT_SECRET" "ANTHROPIC_API_KEY" "TWO_FACTOR_API_KEY" }}
        - name: {{ $key }}
          valueFrom:
            secretKeyRef:
              name: {{ include "medzo.secretName" $ }}
              key: {{ $key }}
              optional: {{ ne $key "MONGODB_URI" }}
        {{- end }}
        {{- if .Values.redis.enabled }}
        - name: REDIS_URL
          value: "redis://{{ include "medzo.fullname" . }}-redis:6379"
        {{- end }}
        {{- if .Values.tracing.enabled }}
        # OpenTelemetry zero-code instrumentation
        # https://opentelemetry.io/docs/zero-code/js/
        - name: NODE_OPTIONS
          value: --require @opentelemetry/auto-instrumentations-node/register
        - name: OTEL_SERVICE_NAME
          value: medzo-api
        - name: OTEL_TRACES_EXPORTER
          value: otlp
        - name: OTEL_METRICS_EXPORTER
          value: none
        - name: OTEL_LOGS_EXPORTER
          value: none
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: {{ .Values.tracing.endpoint | quote }}
        - name: OTEL_TRACES_SAMPLER
          value: {{ .Values.tracing.sampler | quote }}
        - name: OTEL_TRACES_SAMPLER_ARG
          value: {{ .Values.tracing.samplerArg | quote }}
        - name: OTEL_RESOURCE_ATTRIBUTES
          value: "service.version={{ include "medzo.imageTag" . }},deployment.environment={{ .Release.Namespace }}"
        {{- end }}
      startupProbe:
        {{- toYaml .Values.startupProbe | nindent 8 }}
      livenessProbe:
        {{- toYaml .Values.livenessProbe | nindent 8 }}
      readinessProbe:
        {{- toYaml .Values.readinessProbe | nindent 8 }}
      lifecycle:
        preStop:
          exec:
            command: ["sleep", "{{ .Values.preStopSleepSeconds }}"]
      resources:
        {{- toYaml .Values.resources | nindent 8 }}
      volumeMounts:
        # readOnlyRootFilesystem: give Node a writable /tmp only
        - name: tmp
          mountPath: /tmp
  volumes:
    - name: tmp
      emptyDir: {}
  {{- with .Values.nodeSelector }}
  nodeSelector:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.affinity }}
  affinity:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.tolerations }}
  tolerations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end }}
