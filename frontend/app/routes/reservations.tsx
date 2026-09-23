import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { PickerDay } from "@mui/x-date-pickers/PickerDay";
import type { PickerDayProps } from "@mui/x-date-pickers/PickerDay";
import dayjs, { type Dayjs } from "dayjs";

import {
  clearAuthTokens,
  compositeApi,
  environmentApi,
  hasValidAccessToken,
  reservationApi,
  resourceApi,
  userApi,
} from "../services/api";
import type { CompositeReservation, Reservation, Resource, Room, User } from "../services/api";

import { CancelDialog } from "./reservations/CancelDialog";
import { CompositeDialog } from "./reservations/CompositeDialog";
import { CompositeManageDialog } from "./reservations/CompositeManageDialog";
import { IncidentDialog } from "./reservations/IncidentDialog";
import { ReservationCard } from "./reservations/ReservationCard";
import { ReservationFormDialog } from "./reservations/ReservationFormDialog";
import { RecommendationDialog } from "./reservations/RecommendationDialog";

export default function ReservationsPage() {
  const navigate = useNavigate();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [environments, setEnvironments] = useState<Room[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [visibleMonth, setVisibleMonth] = useState<Dayjs>(dayjs());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [incidentTarget, setIncidentTarget] = useState<Reservation | null>(null);
  const [compositeOpen, setCompositeOpen] = useState(false);
  const [compositeManage, setCompositeManage] = useState<CompositeReservation | null>(null);

  const isStaff =
    currentUser?.roles.includes("admin") ||
    currentUser?.roles.includes("manager") ||
    currentUser?.roles.includes("technician");

  const handleAuthError = (message: string): boolean => {
    if (
      message.includes("Sua sessão expirou") ||
      message.includes("Could not validate credentials") ||
      message.includes("Token expired")
    ) {
      clearAuthTokens();
      navigate("/login");
      return true;
    }
    return false;
  };

  const handleError = (message: string) => {
    if (!handleAuthError(message)) setError(message);
  };

  const loadReservations = async (month: Dayjs) => {
    setLoading(true);
    setError("");
    try {
      const start = month.startOf("month").toISOString();
      const end = month.endOf("month").toISOString();
      const data = await reservationApi.list({
        start_after: start,
        end_before: end,
        limit: 500,
      });
      setReservations(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao carregar reservas";
      handleError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasValidAccessToken()) {
      navigate("/login");
      return;
    }
    const bootstrap = async () => {
      try {
        const [envs, res, allUsers, me] = await Promise.all([
          environmentApi.getAllRooms(0, 500),
          resourceApi.getAllResources(0, 500, true),
          userApi.getAllUsers(0, 500),
          userApi.getCurrentUser(),
        ]);
        setEnvironments(envs);
        setResources(res);
        setUsers(allUsers);
        setCurrentUser(me);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Falha ao carregar dados auxiliares";
        handleError(message);
      }
    };
    bootstrap();
    loadReservations(visibleMonth);
  }, [navigate]);

  const reservationsByDay = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations) {
      const key = dayjs(r.start_time).format("YYYY-MM-DD");
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [reservations]);

  const dayReservations = useMemo(() => {
    const key = selectedDate.format("YYYY-MM-DD");
    return reservationsByDay.get(key) ?? [];
  }, [reservationsByDay, selectedDate]);

  const environmentById = useMemo(() => {
    const map = new Map<number, Room>();
    for (const e of environments) map.set(e.id, e);
    return map;
  }, [environments]);

  const reservationsById = useMemo(() => {
    const map = new Map<number, Reservation>();
    for (const r of reservations) map.set(r.id, r);
    return map;
  }, [reservations]);

  const openCreateDialog = () => {
    setEditingReservation(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setIsFormOpen(true);
  };

  const handleManageComposite = async (reservation: Reservation) => {
    try {
      const composite = await compositeApi.getByReservationId(reservation.id);
      setCompositeManage(composite);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Falha ao carregar reserva composta";
      handleError(message);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Reservas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Solicite e acompanhe as reservas dos ambientes da instituição.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            disabled={!currentUser}
          >
            Nova reserva
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setIsRecommendationOpen(true)}
            disabled={!currentUser}
          >
            Encontrar ambiente
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setCompositeOpen(true)}
            disabled={!currentUser}
          >
            Nova composta
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadReservations(visibleMonth)}
            disabled={loading}
          >
            Atualizar
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert
          severity="success"
          onClose={() => setSuccessMessage("")}
          sx={{ mb: 2 }}
        >
          {successMessage}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "minmax(320px, 380px) 1fr" },
          alignItems: "start",
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Calendário
          </Typography>
          <DateCalendar
            value={selectedDate}
            onChange={(value) => value && setSelectedDate(value)}
            onMonthChange={(month) => {
              setVisibleMonth(month);
              loadReservations(month);
            }}
            dayOfWeekFormatter={(date) => {
              const s = (date as Dayjs).format("ddd");
              return s.charAt(0).toUpperCase() + s.slice(1);
            }}
            slots={{
              day: (props: PickerDayProps) => {
                const key = dayjs(props.day as Dayjs).format("YYYY-MM-DD");
                const hasReservations = reservationsByDay.has(key);
                return (
                  <Badge
                    overlap="circular"
                    variant="dot"
                    color="primary"
                    invisible={!hasReservations}
                  >
                    <PickerDay {...props} />
                  </Badge>
                );
              },
            }}
          />
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack
            direction="row"
            sx={{ mb: 2, justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Agenda — {selectedDate.format("DD [de] MMMM [de] YYYY")}
            </Typography>
            {loading && <CircularProgress size={18} />}
          </Stack>

          {dayReservations.length === 0 ? (
            <Alert severity="info" variant="outlined">
              Nenhuma reserva neste dia.
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {dayReservations.map((reservation, index) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  index={index}
                  environmentById={environmentById}
                  currentUser={currentUser}
                  isStaff={!!isStaff}
                  onEdit={openEditDialog}
                  onCancel={setCancelTarget}
                  onUpdated={(updated) =>
                    setReservations((prev) =>
                      prev.map((r) => (r.id === updated.id ? updated : r))
                    )
                  }
                  onSuccess={setSuccessMessage}
                  onError={handleError}
                  onIncident={setIncidentTarget}
                  onManageComposite={handleManageComposite}
                />
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      {currentUser && (
        <ReservationFormDialog
          open={isFormOpen}
          editingReservation={editingReservation}
          selectedDate={selectedDate}
          environments={environments}
          resources={resources}
          users={users}
          currentUser={currentUser}
          onClose={() => setIsFormOpen(false)}
          onCreated={(created) => {
            setReservations((prev) => [...prev, created]);
            setSuccessMessage("Reserva criada e aguardando aprovação");
          }}
          onUpdated={(updated) => {
            setReservations((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setSuccessMessage("Reserva atualizada");
          }}
          onError={handleError}
        />
      )}

      {currentUser && (
        <RecommendationDialog
          open={isRecommendationOpen}
          selectedDate={selectedDate}
          resources={resources}
          users={users}
          currentUser={currentUser}
          onClose={() => setIsRecommendationOpen(false)}
          onCreated={(created) => {
            setReservations((previous) => [...previous, created]);
            setSuccessMessage("Solicitação de reserva enviada");
          }}
          onError={handleError}
        />
      )}

      <CancelDialog
        reservation={cancelTarget}
        environmentById={environmentById}
        onClose={() => setCancelTarget(null)}
        onCancelled={(updated) => {
          setReservations((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
          setSuccessMessage("Reserva cancelada");
        }}
        onError={handleError}
      />

      <CompositeDialog
        open={compositeOpen}
        currentUser={currentUser}
        environments={environments}
        resources={resources}
        users={users}
        onClose={() => setCompositeOpen(false)}
        onCreated={async () => {
          await loadReservations(visibleMonth);
          setSuccessMessage("Reserva composta criada com sucesso");
        }}
        onError={handleError}
      />

      <IncidentDialog
        reservation={incidentTarget}
        environmentById={environmentById}
        onClose={() => setIncidentTarget(null)}
        onSuccess={setSuccessMessage}
        onError={handleError}
      />

      <CompositeManageDialog
        composite={compositeManage}
        reservationsById={reservationsById}
        environmentById={environmentById}
        onClose={() => setCompositeManage(null)}
        onUpdated={(updated) => {
          setCompositeManage(updated);
          setSuccessMessage("Item cancelado com sucesso");
          loadReservations(visibleMonth);
        }}
        onError={handleError}
      />
    </Container>
  );
}
