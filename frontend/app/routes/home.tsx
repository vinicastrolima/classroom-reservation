import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Divider,
  GlobalStyles,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import BlockIcon from "@mui/icons-material/Block";
import PeopleIcon from "@mui/icons-material/People";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BoltIcon from "@mui/icons-material/Bolt";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";

import {
  AUTH_LOGOUT_EVENT,
  clearAuthTokens,
  environmentApi,
  getTokenRoles,
  hasValidAccessToken,
  reservationApi,
} from "../services/api";
import { DemoAccountsBanner, type DemoAccount } from "../ui/DemoAccountsBanner";

dayjs.locale("pt-br");

export const meta = () => {
  return [
    { title: "Início | Sistema de Reserva de Salas" },
    { name: "description", content: "Sistema inteligente de reserva de salas e laboratórios acadêmicos." },
  ];
};

const PINE = "#1f6f5f";
const PINE_DARK = "#14483d";
const TERRA = "#b25e2e";
const INK = "#17322d";
const MUTED = "#4f665f";
const BORDER = "rgba(31, 111, 95, 0.16)";
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

type DaySummary = {
  pending: number | null;
  today: number | null;
  environments: number | null;
};

const formatCount = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : n >= 100 ? "99+" : String(n);

export default function Home() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [now, setNow] = useState(() => dayjs());
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const isStudent = useMemo(() => roles.includes("STUDENT") || roles.includes("student"), [roles]);
  const isAdmin = useMemo(() => roles.includes("ADMIN") || roles.includes("admin"), [roles]);
  const isManager = useMemo(() => roles.includes("MANAGER") || roles.includes("manager") || isAdmin, [roles, isAdmin]);

  useEffect(() => {
    setMounted(true);
    const syncAuthState = () => {
      const authenticated = hasValidAccessToken();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setRoles(getTokenRoles());
      } else {
        setRoles([]);
      }
    };

    syncAuthState();

    const authInterval = window.setInterval(syncAuthState, 15000);
    const clockInterval = window.setInterval(() => setNow(dayjs()), 60000);
    window.addEventListener("focus", syncAuthState);
    window.addEventListener("storage", syncAuthState);
    window.addEventListener(AUTH_LOGOUT_EVENT, syncAuthState as EventListener);

    return () => {
      window.clearInterval(authInterval);
      window.clearInterval(clockInterval);
      window.removeEventListener("focus", syncAuthState);
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener(AUTH_LOGOUT_EVENT, syncAuthState as EventListener);
    };
  }, []);

  const handleLogout = () => {
    clearAuthTokens();
    setIsAuthenticated(false);
    setRoles([]);
    navigate("/");
  };

  const handleDemoLogin = (account: DemoAccount) => {
    navigate("/login");
  };

  const greeting = useMemo(() => {
    const hour = now.hour();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, [now]);

  const dateline = useMemo(() => {
    const formatted = now.format("dddd, D [de] MMMM [de] YYYY");
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [now]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    const load = async () => {
      const startOfDay = dayjs().startOf("day").toISOString();
      const endOfDay = dayjs().endOf("day").toISOString();
      const results = await Promise.allSettled([
        reservationApi.listPending(0, 100),
        reservationApi.list({ start_after: startOfDay, end_before: endOfDay, limit: 100 }),
        environmentApi.getAllRooms(0, 500),
      ]);
      if (cancelled) return;
      setSummary({
        pending: results[0].status === "fulfilled" ? results[0].value.length : null,
        today: results[1].status === "fulfilled" ? results[1].value.length : null,
        environments: results[2].status === "fulfilled" ? results[2].value.length : null,
      });
      setSummaryLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const quickActions = useMemo(() => {
    if (!isAuthenticated) return [];

    if (isStudent) {
      return [
        {
          title: "Nova Solicitação de Sala",
          desc: "Solicite um laboratório ou sala para estudos e atividades acadêmicas",
          to: "/reservas",
          icon: AddCircleOutlineIcon,
          color: PINE,
          badge: "Rápido",
        },
        {
          title: "Consultar Ambientes",
          desc: "Veja capacidade, recursos multimídia e horários de funcionamento",
          to: "/environments",
          icon: MeetingRoomIcon,
          color: TERRA,
        },
        {
          title: "Minhas Reservas Ativas",
          desc: "Acompanhe aprovações, horários e faça check-in de uso",
          to: "/reservas",
          icon: EventAvailableIcon,
          color: "#3f51b5",
        },
      ];
    }

    const actions = [
      {
        title: "Nova Reserva de Sala",
        desc: "Agendamento simples, recorrente ou composto para aulas e eventos",
        to: "/reservas",
        icon: AddCircleOutlineIcon,
        color: PINE,
      },
      {
        title: "Salas e Ambientes",
        desc: "Catálogo completo de salas de aula, laboratórios e auditórios",
        to: "/environments",
        icon: MeetingRoomIcon,
        color: TERRA,
      },
    ];

    if (isManager) {
      actions.push({
        title: "Fila de Aprovações",
        desc: "Avalie e aprove solicitações para ambientes controlados e restritos",
        to: "/aprovacoes",
        icon: HowToRegIcon,
        color: "#d32f2f",
        badge: summary?.pending ? `${summary.pending} pendente(s)` : undefined,
      });
      actions.push({
        title: "Bloqueios e Feriados",
        desc: "Cadastre períodos de manutenção e datas não letivas no calendário",
        to: "/bloqueios",
        icon: BlockIcon,
        color: "#f57c00",
      });
    }

    if (isAdmin) {
      actions.push({
        title: "Gestão de Usuários",
        desc: "Controle de permissões, papéis de acesso e departamentos",
        to: "/users",
        icon: PeopleIcon,
        color: "#7b1fa2",
      });
    }

    return actions;
  }, [isAuthenticated, isStudent, isManager, isAdmin, summary?.pending]);

  return (
    <Box sx={{ position: "relative", minHeight: "100dvh", bgcolor: "background.default", pb: 8 }}>
      <GlobalStyles
        styles={{
          "@keyframes home-fade": {
            from: { opacity: 0, transform: "translateY(12px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          ".home-fade": {
            animation: `home-fade 500ms ${EASE} both`,
          },
        }}
      />

      {/* Hero Header Container */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${PINE_DARK} 0%, ${INK} 60%, #1f2a28 100%)`,
          color: "#ffffff",
          pt: { xs: 5, md: 7 },
          pb: { xs: 7, md: 9 },
          px: 2,
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Subtle decorative circles */}
        <Box
          sx={{
            position: "absolute",
            top: "-20%",
            right: "-10%",
            width: 450,
            height: 450,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(178,94,46,0.25) 0%, rgba(31,111,95,0) 70%)",
            filter: "blur(40px)",
            pointerEvents: "none",
          }}
        />

        <Container maxWidth="lg" className="home-fade">
          {/* Top Pill / Dateline */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: TERRA,
                  boxShadow: "0 0 12px #b25e2e",
                }}
              />
              <Typography
                sx={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                Campus Central • Gestão de Espaços
              </Typography>
            </Stack>

            <Typography sx={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums" }}>
              {mounted ? dateline : " "}
            </Typography>
          </Stack>

          {/* Main Headline */}
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography
                component="h1"
                sx={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 800,
                  fontSize: { xs: "2.4rem", sm: "3.2rem", md: "3.8rem" },
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: "#ffffff",
                  mb: 2,
                }}
              >
                O espaço certo,
                <br />
                no{" "}
                <Box component="span" sx={{ color: "#e89463", fontStyle: "italic", borderBottom: "3px solid #b25e2e" }}>
                  tempo certo
                </Box>
                .
              </Typography>

              <Typography
                sx={{
                  fontSize: { xs: "1rem", md: "1.15rem" },
                  color: "rgba(255, 255, 255, 0.8)",
                  lineHeight: 1.6,
                  maxWidth: 560,
                  mb: 3.5,
                }}
              >
                {isAuthenticated
                  ? `${greeting}! Gerencie agendamentos, consulte salas e acompanhe a disponibilidade em tempo real sem conflitos.`
                  : "Consulte salas de aula, laboratórios e auditórios, solicite agendamentos e acompanhe a disponibilidade acadêmica de forma simplificada."}
              </Typography>

              {/* Action Buttons */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                {isAuthenticated ? (
                  <>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<AddCircleOutlineIcon />}
                      onClick={() => navigate("/reservas")}
                      sx={{
                        bgcolor: TERRA,
                        "&:hover": { bgcolor: "#9c4d21" },
                        px: 3.5,
                        py: 1.3,
                        fontWeight: 700,
                        borderRadius: 2.5,
                      }}
                    >
                      {isStudent ? "Solicitar Sala" : "Nova Reserva"}
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => navigate("/environments")}
                      sx={{
                        color: "#ffffff",
                        borderColor: "rgba(255,255,255,0.4)",
                        "&:hover": { borderColor: "#ffffff", bgcolor: "rgba(255,255,255,0.08)" },
                        px: 3,
                        py: 1.3,
                        borderRadius: 2.5,
                      }}
                    >
                      Explorar Ambientes
                    </Button>
                    <Button
                      variant="text"
                      size="large"
                      onClick={handleLogout}
                      sx={{ color: "rgba(255,255,255,0.6)", "&:hover": { color: "#ffffff" } }}
                    >
                      Sair
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      size="large"
                      href="/login"
                      sx={{
                        bgcolor: TERRA,
                        "&:hover": { bgcolor: "#9c4d21" },
                        px: 4,
                        py: 1.4,
                        fontWeight: 700,
                        borderRadius: 2.5,
                        boxShadow: "0 8px 24px rgba(178,94,46,0.35)",
                      }}
                    >
                      Acessar o Sistema
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      href="/register"
                      sx={{
                        color: "#ffffff",
                        borderColor: "rgba(255,255,255,0.4)",
                        "&:hover": { borderColor: "#ffffff", bgcolor: "rgba(255,255,255,0.08)" },
                        px: 3,
                        py: 1.4,
                        borderRadius: 2.5,
                      }}
                    >
                      Criar Conta
                    </Button>
                  </>
                )}
              </Stack>
            </Grid>

            {/* Right column: Live KPI Cards */}
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  bgcolor: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(16px)",
                  borderRadius: 3.5,
                  p: { xs: 2.5, md: 3 },
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <BoltIcon sx={{ color: "#e89463" }} />
                  <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "#ffffff" }}>
                    Painel Operacional
                  </Typography>
                  {isStudent && (
                    <Chip label="Perfil Aluno" size="small" sx={{ ml: "auto", bgcolor: "rgba(255,255,255,0.2)", color: "#fff" }} />
                  )}
                </Stack>

                <Stack spacing={2}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor: "rgba(0, 0, 0, 0.2)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
                        Ambientes Cadastrados
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", color: "#ffffff" }}>
                        {formatCount(summary?.environments ?? 15)}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: "rgba(31, 111, 95, 0.4)", color: "#ffffff" }}>
                      <MeetingRoomIcon />
                    </Avatar>
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor: "rgba(0, 0, 0, 0.2)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Box>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
                        Reservas para Hoje
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", color: "#ffffff" }}>
                        {formatCount(summary?.today ?? 0)}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: "rgba(178, 94, 46, 0.4)", color: "#ffffff" }}>
                      <EventAvailableIcon />
                    </Avatar>
                  </Box>

                  {isManager && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: "rgba(0, 0, 0, 0.2)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)" }}>
                          Aprovações Pendentes
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", color: "#e89463" }}>
                          {formatCount(summary?.pending ?? 0)}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: "rgba(211, 47, 47, 0.4)", color: "#ffffff" }}>
                        <HowToRegIcon />
                      </Avatar>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Main Content Area */}
      <Container maxWidth="lg" sx={{ mt: 5 }}>
        {/* Unauthenticated / Demo Banner */}
        {!isAuthenticated && (
          <Box sx={{ mb: 5 }}>
            <DemoAccountsBanner onSelectAccount={handleDemoLogin} />
          </Box>
        )}

        {/* Quick Actions Grid for Logged-In Users */}
        {isAuthenticated && quickActions.length > 0 && (
          <Box sx={{ mb: 5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
              <Typography
                sx={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 700,
                  fontSize: "1.3rem",
                  color: INK,
                }}
              >
                Ações Rápidas
              </Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: BORDER }} />
            </Stack>

            <Grid container spacing={2.5}>
              {quickActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <Grid item xs={12} sm={6} md={isStudent ? 4 : 3} key={idx}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        height: "100%",
                        transition: "all 0.25s ease",
                        "&:hover": {
                          borderColor: action.color,
                          transform: "translateY(-4px)",
                          boxShadow: "0 12px 24px rgba(23, 50, 45, 0.08)",
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => navigate(action.to)}
                        sx={{ height: "100%", p: 2.5, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between" }}
                      >
                        <Box sx={{ width: "100%" }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                            <Avatar
                              sx={{
                                bgcolor: `${action.color}18`,
                                color: action.color,
                                width: 44,
                                height: 44,
                              }}
                            >
                              <Icon />
                            </Avatar>
                            {action.badge && (
                              <Chip
                                label={action.badge}
                                size="small"
                                color="error"
                                sx={{ fontWeight: 700, height: 22 }}
                              />
                            )}
                          </Stack>
                          <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", color: INK, mb: 0.8 }}>
                            {action.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: MUTED, lineHeight: 1.4 }}>
                            {action.desc}
                          </Typography>
                        </Box>

                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 2, color: action.color, fontWeight: 700, fontSize: "0.88rem" }}>
                          <span>Acessar</span>
                          <ArrowForwardIcon sx={{ fontSize: 16 }} />
                        </Stack>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* Feature Cards / Value Pillars */}
        <Box sx={{ mt: 5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
            <Typography
              sx={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: "1.3rem",
                color: INK,
              }}
            >
              Diretrizes de Uso dos Ambientes
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: BORDER }} />
          </Stack>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 3, p: 2.5, height: "100%", bgcolor: "background.paper" }}>
                <CardContent sx={{ p: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", color: PINE, mb: 1 }}>
                    1. Criticidade & Aprovação
                  </Typography>
                  <Typography variant="body2" sx={{ color: MUTED, lineHeight: 1.5 }}>
                    Salas comuns têm aprovação instantânea. Laboratórios e auditórios controlados passam por validação do gestor responsável.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 3, p: 2.5, height: "100%", bgcolor: "background.paper" }}>
                <CardContent sx={{ p: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", color: TERRA, mb: 1 }}>
                    2. Check-in e Tolerância
                  </Typography>
                  <Typography variant="body2" sx={{ color: MUTED, lineHeight: 1.5 }}>
                    Confirme sua presença no início da reserva. Ausências após o tempo de tolerância configurado liberam a sala automaticamente.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderRadius: 3, p: 2.5, height: "100%", bgcolor: "background.paper" }}>
                <CardContent sx={{ p: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", color: "#14483d", mb: 1 }}>
                    3. Buffers Operacionais
                  </Typography>
                  <Typography variant="body2" sx={{ color: MUTED, lineHeight: 1.5 }}>
                    Intervalos de setup e limpeza são adicionados automaticamente entre reservas para manter os ambientes sempre organizados.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
