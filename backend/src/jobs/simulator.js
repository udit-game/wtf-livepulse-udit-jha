const { broadcast } = require("../websocket/server");
const simRepo = require("../repositories/simulatorRepository");
const gymRepository = require("../repositories/gymRepository");
const config = require("../config");

// Hourly Traffic Multipliers (00:00 - 23:00 local app timezone)
const HOURLY_MULTIPLIERS = [
  0.00, 0.00, 0.00, 0.00, 0.00, 0.30, // 00:00 - 05:59
  0.60, 1.00, 1.00, 1.00,             // 06:00 - 09:59 (Morning Rush)
  0.40, 0.40,                         // 10:00 - 11:59
  0.30, 0.30,                         // 12:00 - 13:59
  0.20, 0.20, 0.20,                   // 14:00 - 16:59
  0.90, 0.90, 0.90, 0.90,             // 17:00 - 20:59 (Evening Rush)
  0.35, 0.35,                         // 21:00 - 22:30
  0.00                                // 23:00
];
let timerId = null;

const APP_TIMEZONE = config.appTimezone || 'Asia/Kolkata';

function getTrafficMultiplier(date = new Date()) {
  const options = { timeZone: APP_TIMEZONE, hour: '2-digit', hour12: false };
  const hourString = new Intl.DateTimeFormat([], options).format(date);
  const hour = parseInt(hourString, 10) % 24;
  return HOURLY_MULTIPLIERS[hour] ?? 0.0;
}

async function tickSimulator(status = "paused") {
  if (status !== "running") return;

  try {
    const multiplier = getTrafficMultiplier();
    const eventProbability = 0.7 * multiplier;
    if (Math.random() > Math.min(eventProbability, 0.95)) return;

    const roll = Math.random();
    if (roll < 0.45) {
      await handleCheckinEvent();
    } else if (roll < 0.90) {
      await handleCheckoutEvent();
    } else {
      await handlePaymentEvent();
    }
  } catch (err) {
    console.error("Error during simulator tick:", err);
  }
}

async function handleCheckinEvent() {
  const member = await simRepo.pickActiveMemberNotCheckedIn();
  if (!member) return;

  const now = new Date().toISOString();
  await simRepo.insertCheckin(member.member_id, member.gym_id, now);

  const currentOccupancy = await simRepo.getCurrentOccupancy(member.gym_id);
  const capacityPct = parseFloat(((currentOccupancy / member.capacity) * 100).toFixed(1));

  await simRepo.updateMemberLastCheckin(member.member_id, now);

  broadcast({
    type: "CHECKIN_EVENT",
    gym_id: member.gym_id,
    member_name: member.member_name,
    timestamp: now,
    current_occupancy: currentOccupancy,
    capacity_pct: capacityPct,
  });
}

async function handleCheckoutEvent() {
  const checkin = await simRepo.pickRandomOpenCheckin();
  if (!checkin) return;

  const now = new Date().toISOString();
  await simRepo.closeCheckin(checkin.checkin_id, now);

  const currentOccupancy = await simRepo.getCurrentOccupancy(checkin.gym_id);
  const capacityPct = parseFloat(((currentOccupancy / checkin.capacity) * 100).toFixed(1));

  broadcast({
    type: "CHECKOUT_EVENT",
    gym_id: checkin.gym_id,
    member_name: checkin.member_name,
    timestamp: now,
    current_occupancy: currentOccupancy,
    capacity_pct: capacityPct,
  });
}

async function handleSystemResetEvent() {
  await simRepo.resetToBaseline();
  const gyms = await gymRepository.getAllActiveGyms();
  gyms.forEach((gym) => {
    broadcast({
      type: "CHECKOUT_EVENT",
      gym_id: gym.id,
      member_name: "System Reset",
      timestamp: new Date().toISOString(),
      current_occupancy: 0,
      capacity_pct: 0,
    });
  });
}

async function handlePaymentEvent() {
  const member = await simRepo.pickRandomActiveMember();
  if (!member) return;

  const now = new Date().toISOString();
  const amounts = { monthly: 1499.00, quarterly: 3999.00, annual: 11999.00 };
  const amount = amounts[member.plan_type] || 1499.00;

  await simRepo.insertPayment(member.member_id, member.gym_id, amount, member.plan_type, now);
  const todayTotal = await simRepo.getTodayTotal(member.gym_id, APP_TIMEZONE);

  broadcast({
    type: "PAYMENT_EVENT",
    gym_id: member.gym_id,
    amount: amount,
    plan_type: member.plan_type,
    member_name: member.member_name,
    today_total: todayTotal,
  });
}

function startSimulatorTimer(state) {
  if (timerId) clearInterval(timerId);

  const intervalMs = Math.max(Math.round(2000 / state.speed), 100);
  timerId = setInterval(() => tickSimulator(state.status), intervalMs);
}

function stopSimulatorTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

module.exports = {
  startSimulatorTimer,
  stopSimulatorTimer,
  getTrafficMultiplier,
  tickSimulator,
  handleSystemResetEvent
};