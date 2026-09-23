import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { type Dayjs } from "dayjs";

import {
  type EnvironmentRecommendation,
  type EnvironmentType,
  type Location,
  type RecommendationCriteria,
  type Reservation,
  type ReservationPurpose,
  type Resource,
  type ResourceType,
  type SupportType,
  type User,
  locationApi,
  recommendationApi,
  reservationApi,
  SUPPORT_TYPES,
  SUPPORT_TYPE_LABELS,
} from "../../services/api";
import {
  MAX_TIME,
  MIN_TIME,
  RESERVATION_PURPOSE_OPTIONS,
  dateOrInvalid,
  toIdOrEmpty,
  toPurposeValue,
} from "./constants";

const ENVIRONMENT_TYPES: { value: EnvironmentType; label: string }[] = [
  { value: "CLASSROOM", label: "Sala de aula" },
  { value: "LABORATORY", label: "Laboratório" },
  { value: "AUDITORIUM", label: "Auditório" },
  { value: "MEETING_ROOM", label: "Sala de reunião" },
  { value: "STUDIO", label: "Estúdio" },
  { value: "MULTIPURPOSE", label: "Multipropósito" },
];

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  EQUIPMENT: "Equipamento",
  FURNITURE: "Mobiliário",
  SOFTWARE_LICENSE: "Licença de software",
  KEY: "Chave",
  SUPPLY: "Suprimento",
  KIT: "Kit",
};

interface RecommendationForm {
  startTime: Dayjs;
  endTime: Dayjs;
  participantCount: number;
  purpose: ReservationPurpose | "";
  responsibleId: number | "";
  acceptTerms: boolean;
  environmentTypes: EnvironmentType[];
  locationId: number | "";
  resourceTypes: ResourceType[];
  supportTypes: SupportType[];
}

interface RecommendationDialogProps {
  open: boolean;
  selectedDate: Dayjs;
  resources: Resource[];
  users: User[];
  currentUser: User;
  onClose: () => void;
  onCreated: (reservation: Reservation) => void;
  onError: (message: string) => void;
}

function initialForm(selectedDate: Dayjs, currentUser: User): RecommendationForm {
  const startTime = selectedDate.hour(9).minute(0).second(0).millisecond(0);
  return {
    startTime,
    endTime: startTime.add(2, "hour"),
    participantCount: 1,
    purpose: "",
    responsibleId: currentUser.id,
    acceptTerms: false,
    environmentTypes: [],
    locationId: "",
    resourceTypes: [],
    supportTypes: [],
  };
}

export function RecommendationDialog({
  open,
  selectedDate,
  resources,
  users,
  currentUser,
  onClose,
  onCreated,
  onError,
}: RecommendationDialogProps) {
  const [form, setForm] = useState<RecommendationForm>(() =>
    initialForm(selectedDate, currentUser)
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [recommendations, setRecommendations] = useState<EnvironmentRecommendation[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<EnvironmentRecommendation | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resourceTypes = useMemo(
    () => Array.from(new Set(resources.map((resource) => resource.type))).sort(),
    [resources]
  );

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(selectedDate, currentUser));
    setRecommendations([]);
    setSelectedRecommendation(null);
    setMessage("");
  }, [open, selectedDate, currentUser]);

  useEffect(() => {
    locationApi.getAllLocations(0, 500).then(setLocations).catch(() => setLocations([]));
  }, []);

  const validate = (): string | null => {
    if (!form.startTime.isValid() || !form.endTime.isValid()) return "Datas inválidas";
    if (!form.endTime.isAfter(form.startTime)) return "O término deve ser depois do início";
    if (form.participantCount < 1) return "Número de participantes inválido";
    if (form.purpose === "") return "Selecione a finalidade da reserva";
    if (form.responsibleId === "") return "Selecione um responsável";
    if (!form.acceptTerms) return "Aceite os termos de responsabilidade para continuar";
    return null;
  };

  const handleSearch = async () => {
    const validationError = validate();
    if (validationError) {
      setMessage(validationError);
      return;
    }
    const criteria: RecommendationCriteria = {
      start_time: form.startTime.toISOString(),
      end_time: form.endTime.toISOString(),
      participant_count: form.participantCount,
      environment_types: form.environmentTypes,
      location_id: form.locationId === "" ? undefined : form.locationId,
      required_resource_types: form.resourceTypes,
      support_types: form.supportTypes,
      strategy: "WEIGHTED_SCORE",
      limit: 3,
    };
    setLoading(true);
    setMessage("");
    setSelectedRecommendation(null);
    try {
      const response = await recommendationApi.find(criteria);
      setRecommendations(response.recommendations);
      setMessage(response.message ?? "");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Falha ao buscar recomendações";
      setMessage(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRecommendation || form.purpose === "" || form.responsibleId === "") return;
    setSubmitting(true);
    setMessage("");
    try {
      const reservation = await reservationApi.create({
        environment_id: selectedRecommendation.environment.id,
        requester_id: currentUser.id,
        responsible_id: form.responsibleId,
        start_time: form.startTime.toISOString(),
        end_time: form.endTime.toISOString(),
        purpose: form.purpose,
        participant_count: form.participantCount,
        accept_terms: true,
        resources: selectedRecommendation.resources.map((resource) => ({
          resource_id: resource.id,
        })),
        support: selectedRecommendation.support_types.map((supportType) => ({
          support_type: supportType,
        })),
      });
      onCreated(reservation);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Falha ao enviar solicitação";
      setMessage(errorMessage);
      onError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Encontrar ambiente recomendado</DialogTitle>
      <DialogContent sx={{ "&.MuiDialogContent-root": { pt: 3 } }}>
        {message && (
          <Alert severity={recommendations.length === 0 ? "info" : "error"} sx={{ mb: 2 }}>
            <AlertTitle>{message}</AlertTitle>
          </Alert>
        )}

        {selectedRecommendation ? (
          <Stack spacing={2}>
            <Alert severity="info">
              Esta é uma prévia. A disponibilidade será confirmada ao enviar a solicitação.
            </Alert>
            <Box>
              <Typography variant="h6">Resumo da solicitação</Typography>
              <Typography>{selectedRecommendation.environment.name}</Typography>
              <Typography color="text.secondary">
                {form.startTime.format("DD/MM/YYYY HH:mm")} – {form.endTime.format("HH:mm")}
                {" · "}{form.participantCount} participante(s)
              </Typography>
            </Box>
            <List dense disablePadding>
              {selectedRecommendation.resources.map((resource) => (
                <ListItem key={resource.id} disableGutters>
                  <ListItemText primary={resource.name} secondary={RESOURCE_TYPE_LABELS[resource.type]} />
                </ListItem>
              ))}
            </List>
            <Button variant="text" onClick={() => setSelectedRecommendation(null)}>
              Escolher outra configuração
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <DateTimePicker
                label="Início"
                value={form.startTime}
                onChange={(value) => setForm((previous) => ({ ...previous, startTime: dateOrInvalid(value) }))}
                minTime={MIN_TIME}
                maxTime={MAX_TIME}
                sx={{ flex: 1 }}
              />
              <DateTimePicker
                label="Término"
                value={form.endTime}
                onChange={(value) => setForm((previous) => ({ ...previous, endTime: dateOrInvalid(value) }))}
                minTime={MIN_TIME}
                maxTime={MAX_TIME}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="Participantes"
              type="number"
              value={form.participantCount}
              onChange={(event) => setForm((previous) => ({
                ...previous,
                participantCount: Math.max(1, Number(event.target.value) || 1),
              }))}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <FormControl fullWidth>
              <InputLabel id="recommendation-purpose-label">Finalidade</InputLabel>
              <Select
                labelId="recommendation-purpose-label"
                label="Finalidade"
                value={form.purpose}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  purpose: toPurposeValue(event.target.value),
                }))}
              >
                {RESERVATION_PURPOSE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="recommendation-responsible-label">Responsável</InputLabel>
              <Select
                labelId="recommendation-responsible-label"
                label="Responsável"
                value={form.responsibleId}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  responsibleId: toIdOrEmpty(event.target.value),
                }))}
              >
                {users.map((user) => <MenuItem key={user.id} value={user.id}>{user.name} ({user.email})</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="recommendation-types-label">Tipos de ambiente</InputLabel>
              <Select
                multiple
                labelId="recommendation-types-label"
                label="Tipos de ambiente"
                value={form.environmentTypes}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  environmentTypes: event.target.value as EnvironmentType[],
                }))}
                renderValue={(selected) => (selected as EnvironmentType[])
                  .map((type) => ENVIRONMENT_TYPES.find((option) => option.value === type)?.label)
                  .join(", ")}
              >
                {ENVIRONMENT_TYPES.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="recommendation-location-label">Localidade</InputLabel>
              <Select
                labelId="recommendation-location-label"
                label="Localidade"
                value={form.locationId}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  locationId: toIdOrEmpty(event.target.value),
                }))}
              >
                <MenuItem value="">Todas as localidades</MenuItem>
                {locations.map((location) => <MenuItem key={location.id} value={location.id}>{location.campus} - {location.building} - {location.floor}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="recommendation-resources-label">Tipos de recurso</InputLabel>
              <Select
                multiple
                labelId="recommendation-resources-label"
                label="Tipos de recurso"
                value={form.resourceTypes}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  resourceTypes: event.target.value as ResourceType[],
                }))}
                renderValue={(selected) => (selected as ResourceType[])
                  .map((type) => RESOURCE_TYPE_LABELS[type])
                  .join(", ")}
              >
                {resourceTypes.map((type) => <MenuItem key={type} value={type}>{RESOURCE_TYPE_LABELS[type]}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="recommendation-support-label">Suporte técnico</InputLabel>
              <Select
                multiple
                labelId="recommendation-support-label"
                label="Suporte técnico"
                value={form.supportTypes}
                onChange={(event) => setForm((previous) => ({
                  ...previous,
                  supportTypes: event.target.value as SupportType[],
                }))}
                renderValue={(selected) => (selected as SupportType[]).map((type) => SUPPORT_TYPE_LABELS[type]).join(", ")}
              >
                {SUPPORT_TYPES.map((type) => <MenuItem key={type} value={type}>{SUPPORT_TYPE_LABELS[type]}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Checkbox checked={form.acceptTerms} onChange={(event) => setForm((previous) => ({ ...previous, acceptTerms: event.target.checked }))} />}
              label="Aceito os termos de responsabilidade pelo uso do ambiente."
            />
            {recommendations.length > 0 && (
              <Stack spacing={1} aria-live="polite">
                <Typography variant="h6">Configurações recomendadas</Typography>
                {recommendations.map((recommendation) => (
                  <Box key={recommendation.environment.id} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>{recommendation.environment.name}</Typography>
                        <Typography variant="body2" color="text.secondary">Capacidade: {recommendation.environment.capacity} · Pontuação: {recommendation.score}</Typography>
                      </Box>
                      <Button variant="contained" onClick={() => setSelectedRecommendation(recommendation)}>Selecionar</Button>
                    </Box>
                    <List dense disablePadding>
                      {recommendation.reasons.map((reason) => <ListItem key={reason} disableGutters><ListItemText primary={reason} /></ListItem>)}
                      {recommendation.resources.map((resource) => <ListItem key={resource.id} disableGutters><ListItemText primary={`${resource.name} · ${RESOURCE_TYPE_LABELS[resource.type]}`} /></ListItem>)}
                    </List>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        {selectedRecommendation ? (
          <Button variant="contained" onClick={handleSubmit} disabled={submitting} aria-busy={submitting}>Enviar solicitação</Button>
        ) : (
          <Button variant="contained" onClick={handleSearch} disabled={loading} aria-busy={loading}>Buscar recomendações</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
