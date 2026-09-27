import express from "express";
import cron from "node-cron";
import fs from "fs";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
const DATA_FILE = "./subscribers.json";

app.use(express.json());
app.use(express.static("public"));

function loadSubscribers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveSubscribers(subscribers) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(subscribers, null, 2));
}

function getLocalSchedule(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  const weekdayNames = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  const day = Number(get("day"));

  return {
    weekday: weekdayNames[get("weekday")],
    weekOfMonth: Math.floor((day - 1) / 7) + 1,
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

app.post("/api/subscribe", (req, res) => {
  const { email, consent, timeZone } = req.body || {};

  if (!email || !String(email).includes("@")) {
    return res.status(400).json({
      error: "Escriu un correu vàlid."
    });
  }

  if (!consent) {
    return res.status(400).json({
      error: "Cal acceptar el correu mensual."
    });
  }

  const tz = timeZone || "Europe/Madrid";
  const now = new Date();
  const schedule = getLocalSchedule(now, tz);

  const subscribers = loadSubscribers();

  const existing = subscribers.find(
    (s) => s.email.toLowerCase() === String(email).toLowerCase()
  );

  if (existing) {
    existing.active = true;
    existing.timeZone = tz;
    existing.weekday = schedule.weekday;
    existing.weekOfMonth = schedule.weekOfMonth;
    existing.hour = schedule.hour;
    existing.minute = schedule.minute;
    existing.lastSentMonth = null;
  } else {
    subscribers.push({
      email: String(email).trim(),
      active: true,
      timeZone: tz,
      weekday: schedule.weekday,
      weekOfMonth: schedule.weekOfMonth,
      hour: schedule.hour,
      minute: schedule.minute,
      subscribedAt: now.toISOString(),
      lastSentMonth: null
    });
  }

  saveSubscribers(subscribers);

  res.json({
    ok: true,
    schedule: `cada mes, setmana ${schedule.weekOfMonth}, a les ${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`
  });
});

app.post("/api/unsubscribe", (req, res) => {
  const { email } = req.body || {};
  const subscribers = loadSubscribers();

  const subscriber = subscribers.find(
    (s) => s.email.toLowerCase() === String(email || "").toLowerCase()
  );

  if (subscriber) {
    subscriber.active = false;
    saveSubscribers(subscribers);
  }

  res.json({ ok: true });
});

async function sendTo(subscriber) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;

  if (!key) {
    return {
      ok: false,
      reason: "Falta RESEND_API_KEY al .env"
    };
  }

  if (!from) {
    return {
      ok: false,
      reason: "Falta FROM_EMAIL al .env"
    };
  }

  const unsubscribe = new URL("/unsubscribe.html", PUBLIC_BASE_URL).toString();

  const payload = {
    from,
    to: [subscriber.email],
    subject: "✦ Lilipo — una mica de color cada mes",
    html: `
      <!doctype html>
      <html>
      <body style="margin:0;background:#f6efe6;font-family:Arial,sans-serif;color:#29222a">
        <div style="max-width:620px;margin:30px auto;padding:42px;border-radius:28px;background:#fffaf5">
          <p style="letter-spacing:.16em;text-transform:uppercase;font-size:11px">LILIPO CLUB</p>
          <h1 style="font-size:42px;line-height:1.02;margin:12px 0">
            Una mica de Lilipo<br>cada mes. ✦
          </h1>
          <p style="font-size:17px;line-height:1.6">
            Novetats, drops, combinacions i petites sorpreses de Lilipo.
          </p>
          <a href="${PUBLIC_BASE_URL}"
             style="display:inline-block;margin-top:18px;padding:14px 20px;border-radius:999px;background:#29222a;color:#fff;text-decoration:none">
            Veure Lilipo
          </a>
          <p style="margin-top:45px;font-size:12px;color:#7a7076">
            Has rebut aquest correu perquè t'has apuntat voluntàriament al Lilipo Club.
            <a href="${unsubscribe}">Donar-me de baixa</a>
          </p>
        </div>
      </body>
      </html>
    `
  };

  try {
    const resendUrl = new URL("https://" + "api.resend.com" + "/emails");
    const response = await fetch(resendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: await response.text()
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: String(error)
    };
  }
}

async function monthlyRobot() {
  const now = new Date();
  const subscribers = loadSubscribers();

  for (const subscriber of subscribers) {
    if (!subscriber.active) continue;

    const timeZone = subscriber.timeZone || "Europe/Madrid";
    const local = getLocalSchedule(now, timeZone);

    const monthKey = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit"
    }).format(now);

    const matches =
      local.weekday === subscriber.weekday &&
      local.weekOfMonth === subscriber.weekOfMonth &&
      local.hour === subscriber.hour &&
      local.minute === subscriber.minute &&
      subscriber.lastSentMonth !== monthKey;

    if (!matches) continue;

    const result = await sendTo(subscriber);

    console.log(
      `Lilipo correu → ${subscriber.email}:`,
      result.ok ? "ENVIAT" : `ERROR: ${result.reason}`
    );

    if (result.ok) {
      subscriber.lastSentMonth = monthKey;
      saveSubscribers(subscribers);
    }
  }
}

cron.schedule("* * * * *", monthlyRobot, {
  timezone: "UTC"
});

app.listen(PORT, () => {
  console.log(`Lilipo oberta a http://localhost:${PORT}`);
});
