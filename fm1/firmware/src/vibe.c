/* SPDX-License-Identifier: GPL-3.0-only */
/* VIBE for the M-VAVE FM-1: the ambient noise synthesizer (vibe.obfusco.us) as a pocket instrument.
 * Colored noise and elemental tones, all synthesized, no samples. Built on Dinghy (zvenson), on Felucca's platform
 * (Leo Kuroshita, Hugelton Instruments) as SLOOP (isod89) carries it. Controls in fm1/VIBE-FM1.md.
 *
 *   black keys   the 11 channels: tap = on/off; hold + KNOB1..4 = its level / freq-or-rate / colour-or-type / drift
 *                (hold several to move them together; a channel that is off comes on when you turn its knob)
 *   white keys   strike: a bell tuned to a Wu Yin pentatonic scale from the root, held = it rings on.
 *                hold BELL / CHIME / GONG / BIRDS + white key = strike that voice instead
 *   KNOB1..4     (nothing held) TILT dark..bright, DRIFT, SPACE (reverb), PULSE (ombak, 0 = off)
 *   PRESETS      the six intents: calming relaxing focussing meditating dreaming floating
 *   HOME + white key 1..6   jump to an intent
 *   SELECT       the root (semitones);  ALGORITHM  the ring's spin
 *   PLAY         pause / resume (a slow fade; the mix and the loop are kept in flash while paused)
 *   REC (held)   record a loop of what you play meanwhile (strikes, channel taps, knobs); let go = it loops.
 *                tap REC = loop on/off, hold REC 1.5 s without playing = clear
 *   LFO          shuffle the channels that are on;  SEQ  evolve on/off (slow self-drift)
 *   FX (held)    swell: the space opens and the tone brightens while held
 *   OCT- OCT+    the strike octave
 *
 * Integers only: the chip has no FPU and no libgcc (docs/RULES.md). Curves come from tools/gen_vibe_tables.py.
 * tests/run_host.sh renders this file on a computer: the sound as a WAV, the screen as PNGs. */
static void app_idle(void);
#define LCD_IDLE app_idle
#define APP_NAME "VIBE"
#define CV_MAX (240u * 176u)                    /* the ring's canvas (in the pool: 84 KB of 336) */
#include "platform.c"
#include "vibe_tables.h"

/* ---- channels */
enum { CH_WHITE, CH_PINK, CH_BLUE, CH_BELL, CH_CHIME, CH_GONG, CH_BIRDS, CH_FIRE, CH_WIND, CH_WATER, CH_EARTH, NCH };
enum { P_VOL, P_FREQ, P_TYPE, P_DRIFT, NPAR };
#define CH_STRIKE NCH                           /* the meter slot of the white keys' strikes */
#define NMETER (NCH + 1)

static const char *const CH_NAME[NCH] = {"white", "pink", "blue", "bell", "chime", "gong", "birds",
                                         "fire", "wind", "water", "earth"};
static const char *const PAIR_NAME[3] = {"violet", "brown", "grey"};
static const char *const TYPE_NAME[4][3] = {{"candle", "campfire", "bonfire"}, {"breeze", "gale", "squall"},
                                            {"stream", "rain", "ocean"}, {"loam", "stone", "crystal"}};
static const uint8_t CH_RGB[NCH][3] = {{212, 212, 212}, {255, 126, 179}, {102, 204, 255}, {255, 209, 102},
                                       {255, 232, 160}, {255, 153, 68}, {136, 238, 136}, {255, 102, 51},
                                       {170, 221, 204}, {68, 170, 255}, {204, 136, 85}};
static const uint8_t PAIR_RGB[3][3] = {{194, 102, 255}, {160, 82, 45}, {154, 165, 177}};
/* the black keys, low to high (bit k of fm1_in.notes, 0 = F3): F#3 G#3 A#3 | C#4 D#4 | F#4 G#4 A#4 | C#5 D#5 | F#5 */
static const uint8_t BLACK_KEY[NCH] = {1, 3, 5, 8, 10, 13, 15, 17, 20, 22, 25};
static const uint8_t WHITE_KEY[16] = {0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23, 24, 26};
/* the periodic voices' strike intervals, seconds (as the web app's rate knobs) */
static const uint8_t RATE_MIN[4] = {8, 3, 20, 5}, RATE_MAX[4] = {90, 40, 120, 60};

/* ---- what survives a power-off */
#define SET_VER 2u
#define NLOOP 384u                              /* loop events: t ms (16) | type (3) << 16 | a (5) << 19 | b (8) << 24 */
static struct {
    uint8_t ver, intent, oct, spin;
    int8_t root;                                /* semitones from C4 */
    uint8_t macro[4];                           /* tilt, drift, space, pulse */
    uint8_t on[NCH];
    uint8_t par[NCH][NPAR];
    uint8_t loop_on, pad;
    uint16_t loop_len, loop_n;                  /* ms (<= 60 s), events */
    uint32_t loop_ev[NLOOP];
} set;

/* ---- the six intents (vibe's src/utils/presets.js, the same mixes in knob units) */
typedef struct { uint8_t ch, vol, freq, type; } mixpart_t;
static const char *const INTENT_NAME[6] = {"calming", "relaxing", "focussing", "meditating", "dreaming", "floating"};
static const uint8_t INTENT_PULSE[6] = {117, 109, 121, 113, 91, 75};   /* 9, 7, 10, 7.83, 4, 2.5 Hz */
static const mixpart_t INTENT_MIX[6][4] = {
    {{CH_PINK, 42, 59, 127}, {CH_WATER, 65, 64, 127}, {CH_BELL, 76, 67, 64}, {NCH, 0, 0, 0}},
    {{CH_PINK, 59, 62, 0}, {CH_WIND, 57, 64, 0}, {CH_CHIME, 57, 91, 64}, {NCH, 0, 0, 0}},
    {{CH_PINK, 64, 62, 0}, {CH_WIND, 51, 64, 0}, {CH_EARTH, 46, 40, 0}, {NCH, 0, 0, 0}},
    {{CH_PINK, 59, 27, 0}, {CH_GONG, 60, 90, 64}, {CH_EARTH, 51, 40, 127}, {NCH, 0, 0, 0}},
    {{CH_PINK, 54, 27, 0}, {CH_BELL, 52, 72, 52}, {CH_WATER, 36, 64, 127}, {NCH, 0, 0, 0}},
    {{CH_PINK, 72, 27, 0}, {CH_CHIME, 78, 127, 76}, {CH_BIRDS, 65, 121, 64}, {CH_WIND, 38, 64, 0}},
};
static const uint8_t PAR_DEFAULT[NCH][NPAR] = {
    {70, 87, 0, 32}, {70, 69, 0, 32}, {70, 100, 0, 32}, {70, 58, 64, 32}, {70, 55, 64, 32}, {70, 75, 64, 32},
    {70, 51, 64, 32}, {70, 64, 0, 32}, {70, 64, 0, 32}, {70, 64, 0, 32}, {70, 40, 0, 32}};

/* ================================================================== the sound (audio ISR) */
static uint32_t isr_rnd = 0x9E3779B9u;
static inline uint32_t rnd_isr(void) { uint32_t x = isr_rnd; x ^= x << 13; x ^= x >> 17; x ^= x << 5; return isr_rnd = x; }

static int32_t sine(uint32_t ph)                /* a full cycle over 2^32 -> -32767..32767 (Dinghy's parabola) */
{
    int32_t x = (int32_t)ph >> 16, ax = x < 0 ? -x : x, y, ay;
    y = (x * (32768 - ax)) >> 13;
    ay = y < 0 ? -y : y;
    y += ((((y * ay) >> 15) - y) * 7373) >> 15;
    return y > 32767 ? 32767 : y < -32767 ? -32767 : y;
}
static inline int32_t clip(int32_t x, int32_t m) { return x > m ? m : x < -m ? -m : x; }

/* control values, written by the main loop, read by the ISR (one writer each) */
static volatile int32_t c_gain[NCH];            /* Q15 targets (0 = off / paused); the ISR glides to them */
static volatile int32_t c_k[3], c_mix[3];       /* noise: one-pole coefficient, colour morph (Q15) */
static volatile int32_t c_wt[4][3];             /* fire, wind, water, earth: the weight of each of the three types */
static volatile int32_t c_wind_f, c_wind_q, c_wind_amp;    /* wind: SVF f (Q15), damping (Q15), gust level (Q15) */
static volatile int32_t c_fire_amp, c_ocean_amp, c_ocean_k;
static volatile uint32_t c_fire_p, c_rain_p;   /* per-frame chance (of 2^32) of a crackle / a drop */
static volatile uint32_t c_earth_inc;           /* earth: the sub's pitch step */
static volatile int32_t c_earth_f, c_earth_q, c_earth_noise, c_earth_sub, c_earth_swell;   /* SVF f, damping; levels (Q15) */
static volatile int32_t c_tilt_a, c_tilt_b;     /* the tilt: low part times a, high part times b (Q15) */
static volatile int32_t c_space, c_fb;          /* reverb send (Q15), comb feedback (Q15) */
static volatile uint32_t c_pulse_inc;           /* ombak LFO step per 32 frames, 0 = off */
static volatile int32_t c_master;               /* 0 paused .. 32767 playing (the ISR ramps to it, ~1 s) */
static volatile uint32_t meter[NMETER];         /* peak per block: the ISR raises, the main loop decays */

/* modal voices: a strike = three decaying sine partials (bells, chimes, gongs, the white keys) */
#define NMV 10u
typedef struct {
    uint32_t ph[3];
    volatile uint32_t inc[3];
    volatile int32_t init[3];                   /* the levels a trigger starts with (Q15) */
    volatile int32_t dec[3], dech[3];           /* per-32-frame decay, free and while held */
    volatile int32_t pl, pr, att_step;          /* pan (Q15), attack ramp per 32 frames (32767 = instant) */
    volatile uint32_t trig, held;
    volatile uint8_t meter, owner;              /* owner: 1 + white key (live), 17 + white key (the loop), 0 none */
    int32_t amp[3], att;
} mvoice_t;
static mvoice_t mv[NMV];

/* chirp voices: one sine gliding (birds, water's bubbles) */
#define NCV 4u
typedef struct {
    uint32_t ph, inc;
    volatile uint32_t inc0;
    volatile int32_t dinc, level, dec, pl, pr;
    volatile uint32_t glide, trig;              /* frames to glide; trig: start (main sets, the ISR clears) */
    volatile uint8_t meter;
    int32_t amp, att;
    uint32_t left;
} cvoice_t;
static cvoice_t cv[NCV];

/* reverb: four combs and two allpasses per side (Freeverb's tunings, shortened), in the pool */
static const uint16_t COMB_LEN[4] = {1116, 1188, 1277, 1356};
static const uint16_t AP_LEN[4] = {556, 441, 579, 464};   /* L: 0 1, R: 2 3 */
static int16_t comb_buf[4][1356] __attribute__((section(".pool")));
static int16_t ap_buf[4][579] __attribute__((section(".pool")));

static void app_audio(int32_t *out, uint32_t n)
{
    static int32_t g[NCH], master, pulse_g = 32767;
    static uint32_t pulse_ph;
    static int32_t b0, b1, b2, wprev, pkprev, brown;            /* noise sources */
    static int32_t nlp[3];                                      /* noise filters */
    static int32_t f_env, f_hp, f_hiss, f_rum;                  /* fire */
    static int32_t w_lp, w_bp;                                  /* wind SVF */
    static int32_t r_env, r_hp, s_lp1, s_lp2, o_lp;             /* water: rain, stream, ocean */
    static uint32_t e_ph;                                       /* earth */
    static int32_t e_lp, e_bp;
    static int32_t t_lpl, t_lpr;                                /* tilt */
    static int32_t comb_lp[4];
    static uint32_t comb_i[4], ap_i[4];
    uint32_t i0, i, c, v;
    uint32_t peak[NMETER] = {0};

    for (i0 = 0; i0 < n; i0 += 32u) {                           /* control rate: every 32 frames */
        int32_t tg, mon[NCH];
        uint32_t act = 0;
        for (c = 0; c < NCH; c++) {
            int32_t d = c_gain[c] - g[c];
            g[c] += d >> 5;
            if (d && (d >> 5) == 0) g[c] = c_gain[c];
            if (g[c]) act |= 1u << c;
            mon[c] = g[c];
        }
        tg = c_master;
        if (master < tg) { master += 24; if (master > tg) master = tg; }
        else if (master > tg) { master -= 24; if (master < tg) master = tg; }
        if (c_pulse_inc) {                                      /* ombak: a gentle 10 % dip at the pulse rate */
            pulse_ph += c_pulse_inc;
            pulse_g = 32767 - ((32767 - sine(pulse_ph)) * 3277 >> 16);
        } else if (pulse_g < 32767) pulse_g += 64;
        for (v = 0; v < NMV; v++) {
            mvoice_t *m = &mv[v];
            uint32_t p;
            if (m->trig) {
                for (p = 0; p < 3u; p++) m->amp[p] = m->init[p];
                m->att = m->att_step >= 32767 ? 32767 : 0;
                m->trig = 0;
            }
            for (p = 0; p < 3u; p++) m->amp[p] = m->amp[p] * (m->held ? m->dech[p] : m->dec[p]) >> 15;
            if (m->att < 32767) { m->att += m->att_step; if (m->att > 32767) m->att = 32767; }
        }
        for (v = 0; v < NCV; v++) {
            cvoice_t *k = &cv[v];
            if (k->trig) { k->inc = k->inc0; k->left = k->glide; k->amp = k->level; k->att = 0; k->trig = 0; }
            if (k->att < 32767) { k->att += 6000; if (k->att > 32767) k->att = 32767; }
            else k->amp = k->amp * k->dec >> 15;
        }
        for (i = i0; i < i0 + 32u && i < n; i++) {
            int32_t w = (int32_t)rnd_isr() >> 19, pk, vio, blu, gry, L = 0, R = 0, s, x, mono;
            /* the colours: white, pink (Kellet), brown (leaky), violet (d white), blue (d pink), grey (brown + violet) */
            b0 = (b0 * 32691 >> 15) + (w * 3245 >> 15);
            b1 = (b1 * 31556 >> 15) + (w * 9716 >> 15);
            b2 = (b2 * 18678 >> 15) + (w * 34494 >> 15);
            pk = b0 + b1 + b2 + (w * 6056 >> 15);
            brown = brown - (brown >> 8) + (w >> 3);
            vio = w - wprev; wprev = w;
            blu = (pk - pkprev) * 2; pkprev = pk;
            gry = (brown + vio) >> 1;
            mono = 0;
            if (act & 1u << CH_WHITE) {
                x = w * 2 + (((vio - w * 2) * c_mix[0]) >> 15);
                nlp[0] += (clip(x, 30000) - nlp[0]) * c_k[0] >> 15;
                s = nlp[0] * mon[CH_WHITE] >> 12; mono += s;
                if ((uint32_t)(s < 0 ? -s : s) > peak[CH_WHITE]) peak[CH_WHITE] = (uint32_t)(s < 0 ? -s : s);
            }
            if (act & 1u << CH_PINK) {
                x = pk + (((brown * 2 - pk) * c_mix[1]) >> 15);
                nlp[1] += (clip(x, 30000) - nlp[1]) * c_k[1] >> 15;
                s = nlp[1] * mon[CH_PINK] >> 12; mono += s;
                if ((uint32_t)(s < 0 ? -s : s) > peak[CH_PINK]) peak[CH_PINK] = (uint32_t)(s < 0 ? -s : s);
            }
            if (act & 1u << CH_BLUE) {
                x = clip(blu + (((gry - blu) * c_mix[2]) >> 15), 30000);
                nlp[2] += (x - nlp[2]) * c_k[2] >> 15;
                s = (x - nlp[2]) * mon[CH_BLUE] >> 14; mono += s;                 /* high-pass */
                if ((uint32_t)(s < 0 ? -s : s) > peak[CH_BLUE]) peak[CH_BLUE] = (uint32_t)(s < 0 ? -s : s);
            }
            if (act & 1u << CH_FIRE) {                          /* crackles, hiss, a low rumble */
                if (rnd_isr() < c_fire_p) f_env = 6000 + (int32_t)(rnd_isr() >> 19) * 3;
                f_env -= f_env >> 6;
                x = w * f_env >> 12;
                f_hp += (x - f_hp) * 9000 >> 15;
                f_hiss += (w - f_hiss) * 2500 >> 15;
                f_rum += (brown - f_rum) * 300 >> 15;
                s = (((x - f_hp) >> 2) + (f_hiss * c_wt[0][0] >> 16) + (f_rum * 3 * c_wt[0][2] >> 15)) * c_fire_amp >> 15;
                s = s * mon[CH_FIRE] >> 11; mono += s;
                if ((uint32_t)(s < 0 ? -s : s) > peak[CH_FIRE]) peak[CH_FIRE] = (uint32_t)(s < 0 ? -s : s);
            }
            if (act & 1u << CH_WIND) {                          /* white through a wandering band-pass */
                int32_t hp;
                w_lp += c_wind_f * w_bp >> 15;
                hp = w * 2 - w_lp - (c_wind_q * w_bp >> 15);
                w_bp += c_wind_f * hp >> 15;
                w_bp = clip(w_bp, 60000);
                s = ((w_bp >> 1) * c_wind_amp >> 14) * mon[CH_WIND] >> 11; mono += s;
                if ((uint32_t)(s < 0 ? -s : s) > peak[CH_WIND]) peak[CH_WIND] = (uint32_t)(s < 0 ? -s : s);
            }
            if (act & 1u << CH_WATER) {                         /* stream trickle, rain drops, ocean swell */
                if (rnd_isr() < c_rain_p) r_env = 3000 + (int32_t)(rnd_isr() >> 20);
                r_env -= r_env >> 7;
                x = w * r_env >> 12;
                r_hp += (x - r_hp) * 6000 >> 15;
                s_lp1 += (w - s_lp1) * 8000 >> 15;
                s_lp2 += (w - s_lp2) * 2800 >> 15;
                o_lp += (brown * 2 - o_lp) * c_ocean_k >> 15;
                s = ((s_lp1 - s_lp2) * c_wt[2][0] >> 16) + ((x - r_hp) * c_wt[2][1] >> 15)
                  + ((o_lp * c_ocean_amp >> 15) * c_wt[2][2] >> 15);
                s = s * mon[CH_WATER] >> 14; mono += s;
                if ((uint32_t)(s < 0 ? -s : s) > peak[CH_WATER]) peak[CH_WATER] = (uint32_t)(s < 0 ? -s : s);
            }
            if (act & 1u << CH_EARTH) {                         /* the web's earth: resonant low-pass rumble + a sub */
                int32_t hp;
                e_lp += c_earth_f * e_bp >> 15;
                e_lp = clip(e_lp, 60000);
                hp = w * 4 - e_lp - (c_earth_q * (e_bp >> 1) >> 14);
                e_bp += c_earth_f * hp >> 15;
                e_bp = clip(e_bp, 60000);
                e_ph += c_earth_inc;
                s = (e_lp * c_earth_noise >> 12) + (sine(e_ph) * c_earth_sub >> 15);
                s = (s * c_earth_swell >> 15) * mon[CH_EARTH] >> 14; mono += s;
                if ((uint32_t)(s < 0 ? -s : s) > peak[CH_EARTH]) peak[CH_EARTH] = (uint32_t)(s < 0 ? -s : s);
            }
            L = R = mono;
            for (v = 0; v < NMV; v++) {                         /* the strikes */
                mvoice_t *m = &mv[v];
                if (m->amp[0] < 4 && m->amp[1] < 4 && m->amp[2] < 4) continue;
                m->ph[0] += m->inc[0]; m->ph[1] += m->inc[1]; m->ph[2] += m->inc[2];
                s = (sine(m->ph[0]) * m->amp[0] + sine(m->ph[1]) * m->amp[1] + sine(m->ph[2]) * m->amp[2]) >> 15;
                s = s * m->att >> 15;
                if ((uint32_t)(s < 0 ? -s : s) > peak[m->meter]) peak[m->meter] = (uint32_t)(s < 0 ? -s : s);
                L += s * m->pl >> 15; R += s * m->pr >> 15;
            }
            for (v = 0; v < NCV; v++) {                         /* the chirps */
                cvoice_t *k = &cv[v];
                if (k->amp < 4) continue;
                k->ph += k->inc;
                if (k->left) { k->inc += (uint32_t)k->dinc; k->left--; }
                s = (sine(k->ph) * k->amp >> 15) * k->att >> 15;
                if ((uint32_t)(s < 0 ? -s : s) > peak[k->meter]) peak[k->meter] = (uint32_t)(s < 0 ? -s : s);
                L += s * k->pl >> 15; R += s * k->pr >> 15;
            }
            L = clip(L, 40000); R = clip(R, 40000);             /* (keeps the products below inside 32 bits) */
            {                                                   /* tilt: low part x a + high part x b */
                int32_t hl, hr;
                t_lpl += (L - t_lpl) * 3600 >> 15; t_lpr += (R - t_lpr) * 3600 >> 15;
                hl = L - t_lpl; hr = R - t_lpr;
                L = (t_lpl * c_tilt_a >> 15) + (hl * c_tilt_b >> 15);
                R = (t_lpr * c_tilt_a >> 15) + (hr * c_tilt_b >> 15);
            }
            if (c_space) {                                      /* reverb */
                int32_t in = clip(((L + R) >> 1) * c_space >> 15, 32000) >> 2, acc = 0, yl, yr;
                for (c = 0; c < 4u; c++) {
                    int32_t y = comb_buf[c][comb_i[c]];
                    acc += y;
                    comb_lp[c] += (y - comb_lp[c]) * 13000 >> 15;   /* damping */
                    comb_buf[c][comb_i[c]] = (int16_t)clip(in + (comb_lp[c] * c_fb >> 15), 32767);
                    if (++comb_i[c] >= COMB_LEN[c]) comb_i[c] = 0;
                }
                yl = yr = acc >> 1;
                for (c = 0; c < 4u; c++) {
                    int32_t *y = c < 2u ? &yl : &yr, b = ap_buf[c][ap_i[c]];
                    ap_buf[c][ap_i[c]] = (int16_t)clip(*y + (b >> 1), 32767);
                    *y = b - *y;
                    if (++ap_i[c] >= AP_LEN[c]) ap_i[c] = 0;
                }
                L += yl; R += yr;
            }
            L = (L * master >> 15) * pulse_g >> 15;
            R = (R * master >> 15) * pulse_g >> 15;
            if (L > 20000) L = 20000 + ((L - 20000) >> 2); else if (L < -20000) L = -20000 + ((L + 20000) >> 2);
            if (R > 20000) R = 20000 + ((R - 20000) >> 2); else if (R < -20000) R = -20000 + ((R + 20000) >> 2);
            out[2u * i] += clip(L, 32767);
            out[2u * i + 1u] += clip(R, 32767);
        }
    }
    for (c = 0; c < NMETER; c++)
        if (peak[c] > meter[c]) meter[c] = peak[c];
}

/* ================================================================== the main loop */
static uint32_t rnd_s = 0x2545F491u;
static uint32_t rnd(void) { uint32_t x = rnd_s; x ^= x << 13; x ^= x >> 17; x ^= x << 5; return rnd_s = x; }
static uint32_t rnd_n(uint32_t n) { return n ? (rnd() >> 8) % n : 0; }

static const uint32_t INC_C9[12] = {            /* MIDI 120..131 (C9..B9); lower octaves shift right (Dinghy) */
    815363807u, 863847862u, 915214929u, 969636441u, 1027294024u, 1088380105u,
    1153098554u, 1221665363u, 1294309365u, 1371273005u, 1452813141u, 1539201906u};
static uint32_t note_inc(int32_t note) { if (note < 12) note = 12; if (note > 131) note = 131; return INC_C9[note % 12] >> (10 - note / 12); }
static uint32_t hz_inc(uint32_t hz) { return hz * 97391u; }   /* 2^32 / 44100 = 97391.5 */
static int32_t onepole_k(uint32_t hz)           /* 1 - e^(-2 pi f / fs) ~ x / (1 + x), Q15 */
{
    uint32_t x = hz * 4669u / 1000u;
    return (int32_t)((x << 15) / (32768u + x));
}
static const uint8_t PENTA[5] = {0, 2, 4, 7, 9};   /* Wu Yin: gong shang jue zhi yu */
static int32_t penta_note(int32_t base, int32_t deg)
{
    int32_t o = deg >= 0 ? deg / 5 : -((4 - deg) / 5);
    return base + 12 * o + PENTA[deg - 5 * o];
}

static uint32_t paused, evolve, swell, dirty, t_change;
static int32_t drift[NCH];                      /* each channel's slow wander, Q15 -1..1 */
static int32_t dvel[NCH];
static uint32_t lit_white;                      /* white keys sounding (LEDs) */
static int8_t key_voice[2][16];                 /* the modal voice each white key holds (live, loop), -1 none */

static uint32_t vol_q15(uint32_t v) { return v * v * 2u; }    /* knob 0..127 -> Q15, square law */
static const int32_t NORM[NCH] = {20250, 11760, 22400, 32767, 32767, 32767, 32767, 32500, 20000, 30000, 9350};   /* with the ISR's shifts: ~equal loudness at equal knobs */

/* strikes */
typedef struct { uint16_t ratio[3], amp[3]; int8_t dec[3]; uint16_t att; } timbre_t;
enum { TB_BELL, TB_CHIME, TB_GONG, TB_KEY };
static const timbre_t TIMBRE[4] = {
    {{4096, 8192, 11305}, {14000, 6000, 3500}, {41, 34, 27}, 32767},      /* bell: 1, 2, 2.76 */
    {{4096, 11305, 22118}, {12000, 5000, 2500}, {36, 28, 22}, 32767},     /* chime: 1, 2.76, 5.40 */
    {{4096, 6021, 8561}, {16000, 9000, 6000}, {51, 47, 43}, 300},         /* gong: 1, 1.47, 2.09, swells in */
    {{4096, 8192, 12288}, {12000, 5000, 2200}, {40, 33, 26}, 32767},      /* the keys: 1, 2, 3 (sweeter) */
};
static void ripple(uint32_t col);
static int strike(uint32_t tb, int32_t note, int32_t level, uint32_t pan, uint32_t meter_slot, uint32_t hold)
{
    uint32_t v, pick = 0, best = 0xFFFFFFFFu, p, base = note_inc(note);
    const timbre_t *t = &TIMBRE[tb];
    for (v = 0; v < NMV; v++) {                 /* a free voice, else the quietest one not held */
        uint32_t loud = (uint32_t)(mv[v].amp[0] + mv[v].amp[1]) + (mv[v].held ? 0x40000000u : 0u);
        if (loud < best) { best = loud; pick = v; }
    }
    for (p = 0; p < 3u; p++) {
        int32_t d = t->dec[p], dh = d + 18 > 63 ? 63 : d + 18;
        mv[pick].inc[p] = (uint32_t)((uint64_t)base * t->ratio[p] >> 12);
        mv[pick].init[p] = (int32_t)t->amp[p] * level >> 15;
        mv[pick].dec[p] = DEC32[d];
        mv[pick].dech[p] = DEC32[dh];
    }
    mv[pick].pl = (int32_t)(32767 - pan / 2u);  /* pan 0 (left) .. 65535 (right), equal-ish power */
    mv[pick].pr = (int32_t)(pan / 2u);
    mv[pick].att_step = t->att;
    mv[pick].meter = (uint8_t)meter_slot;
    mv[pick].held = hold ? 1u : 0u;
    mv[pick].owner = (uint8_t)hold;             /* (hold = the owner tag, 0 = not held) */
    mv[pick].trig = 1;
    ripple(meter_slot);
    return (int)pick;
}
static void chirp(uint32_t hz0, uint32_t hz1, uint32_t ms, int32_t level, int32_t dec, uint32_t meter_slot)
{
    uint32_t v, pick = 0, frames = ms * 44u + 1u;
    int32_t best = 0x7FFFFFFF;
    for (v = 0; v < NCV; v++)
        if (cv[v].amp < best) { best = cv[v].amp; pick = v; }
    cv[pick].inc0 = hz_inc(hz0);
    cv[pick].dinc = (int32_t)(hz_inc(hz1) - hz_inc(hz0)) / (int32_t)frames;
    cv[pick].glide = frames;
    cv[pick].level = level;
    cv[pick].dec = dec;
    {
        uint32_t pan = rnd() >> 16;
        cv[pick].pl = (int32_t)(32767 - pan / 2u);
        cv[pick].pr = (int32_t)(pan / 2u);
    }
    cv[pick].meter = (uint8_t)meter_slot;
    cv[pick].trig = 1;
}

static int32_t ch_level(uint32_t c)             /* this channel's Q15 level now (with its drift), for strikes */
{
    int32_t v = (int32_t)set.par[c][P_VOL] + (drift[c] * set.par[c][P_DRIFT] >> 15) / 3;
    v = v < 0 ? 0 : v > 127 ? 127 : v;
    return (int32_t)vol_q15((uint32_t)v);
}
static int32_t root_note(void) { return 60 + set.root; }
static int32_t reg_deg(uint32_t c) { return ((int32_t)set.par[c][P_TYPE] - 64) / 13; }   /* register: -4..+4 steps */

/* the periodic voices: when each strikes next */
static uint32_t next_ms[4], chime_left, chime_next, bird_left, bird_next, bubble_next;
static uint32_t interval_ms(uint32_t c)
{
    uint32_t i = set.par[c][P_FREQ], lo = RATE_MIN[c - CH_BELL] * 1000u, hi = RATE_MAX[c - CH_BELL] * 1000u;
    uint32_t ms = lo + (hi - lo) / 16129u * i * i;
    return ms * (60u + rnd_n(81)) / 100u;        /* +-40 %: never a metronome */
}
static void schedule(void)
{
    uint32_t now = fm1_ms, c;
    if (paused) return;
    for (c = CH_BELL; c <= CH_BIRDS; c++) {
        uint32_t *nx = &next_ms[c - CH_BELL];
        if (!set.on[c]) { *nx = 0; continue; }
        if (!*nx) *nx = now + 300u + rnd_n(1500);
        if ((int32_t)(now - *nx) < 0) continue;
        *nx = now + interval_ms(c);
        switch (c) {
        case CH_BELL:
            strike(TB_BELL, penta_note(root_note() - 12, (int32_t)rnd_n(6) + reg_deg(c)), ch_level(c) * 7 / 8,
                   16384u + rnd_n(32768), c, 0);
            break;
        case CH_CHIME: chime_left = 2u + rnd_n(4); chime_next = now; break;
        case CH_GONG:
            strike(TB_GONG, penta_note(root_note() - 36, (int32_t)rnd_n(2) + reg_deg(c) / 2), ch_level(c),
                   24576u + rnd_n(16384), c, 0);
            break;
        case CH_BIRDS: bird_left = 2u + rnd_n(5); bird_next = now; break;
        }
    }
    if (chime_left && (int32_t)(now - chime_next) >= 0 && set.on[CH_CHIME]) {
        strike(TB_CHIME, penta_note(root_note() + 12, (int32_t)rnd_n(7) + reg_deg(CH_CHIME)), ch_level(CH_CHIME) * 3 / 5,
               rnd() >> 16, CH_CHIME, 0);
        chime_left--;
        chime_next = now + 60u + rnd_n(260);
    }
    if (bird_left && (int32_t)(now - bird_next) >= 0 && set.on[CH_BIRDS]) {
        uint32_t base = 2200u + rnd_n(1800), reg = 70u + set.par[CH_BIRDS][P_TYPE] / 2u;   /* 70 .. 133 % */
        uint32_t f0 = base * reg / 100u, f1 = f0 * (60u + rnd_n(100)) / 100u, d = 40u + rnd_n(100);
        chirp(f0, f1, d, ch_level(CH_BIRDS) / 3, DEC32[6], CH_BIRDS);
        bird_left--;
        bird_next = now + d + 30u + rnd_n(100);
    }
    if (set.on[CH_WATER] && c_wt[2][0] > 2000 && (int32_t)(now - bubble_next) >= 0) {   /* the stream's bubbles */
        uint32_t f0 = 500u + rnd_n(900);
        chirp(f0, f0 * 8u / 5u, 15u + rnd_n(25), (ch_level(CH_WATER) >> 4) * (c_wt[2][0] >> 8) >> 7, DEC32[3], CH_WATER);
        bubble_next = now + (40u + rnd_n(160)) * 32768u / (uint32_t)(c_wt[2][0] + 1);
    }
}

/* the type knob (0..127) as the weights of three types: a triangle each, 0 / 63.5 / 127 */
static void type_weights(uint32_t knob, volatile int32_t *wt)
{
    int32_t t = (int32_t)knob * 2 * 32767 / 127, k;   /* 0 .. 65534 */
    for (k = 0; k < 3; k++) {
        int32_t d = t - k * 32767;
        d = d < 0 ? -d : d;
        wt[k] = d >= 32767 ? 0 : 32767 - d;
    }
}

/* everything the ISR reads, from the knobs, the drift, the macros */
static uint32_t wind_ph, ocean_ph, swell_ph, flick;
static void update_controls(void)
{
    uint32_t c;
    int32_t dm = set.macro[1];                  /* global drift depth */
    for (c = 0; c < NCH; c++) {
        int32_t dd = drift[c] * set.par[c][P_DRIFT] >> 15;          /* -127..127 */
        int32_t v = (int32_t)set.par[c][P_VOL] + (dd * dm >> 7) / 3;
        int32_t g;
        v = v < 0 ? 0 : v > 127 ? 127 : v;
        g = (int32_t)vol_q15((uint32_t)v) * NORM[c] >> 15;
        if (c >= CH_BELL && c <= CH_BIRDS) g = set.on[c] ? 32767 : 0;   /* (those voices carry their own level) */
        c_gain[c] = set.on[c] ? g : 0;
    }
    for (c = 0; c < 3u; c++) {                  /* noise: filter cutoff (with drift), colour morph */
        int32_t f = (int32_t)set.par[c][P_FREQ] + ((drift[c] * set.par[c][P_DRIFT] >> 15) * set.macro[1] >> 7) / 6;
        uint32_t hz;
        f = f < 0 ? 0 : f > 127 ? 127 : f;
        hz = FREQ_HZ[f];
        if (c == CH_WHITE && hz < 400u) hz = 400u;
        c_k[c] = onepole_k(hz);
        c_mix[c] = (int32_t)set.par[c][P_TYPE] * 258;
    }
    type_weights(set.par[CH_FIRE][P_TYPE], c_wt[0]);
    type_weights(set.par[CH_WIND][P_TYPE], c_wt[1]);
    type_weights(set.par[CH_WATER][P_TYPE], c_wt[2]);
    type_weights(set.par[CH_EARTH][P_TYPE], c_wt[3]);
    {                                           /* fire: crackle density from body + type, a flicker */
        uint32_t body = set.par[CH_FIRE][P_FREQ], dens = 6u + body / 4u + (uint32_t)(c_wt[0][1] + c_wt[0][2] * 2) / 1500u;
        c_fire_p = dens * 97391u / 10u;         /* ~dens*0.1 crackles a second ... (of 2^32 per frame) */
        flick = flick + 7u + rnd_n(9);
        c_fire_amp = 26000 + (sine(flick << 22) >> 3) + (int32_t)(drift[CH_FIRE] >> 4);
    }
    {                                           /* wind: centre from body, wanders with drift, gusts */
        int32_t gale = c_wt[1][1], squall = c_wt[1][2];
        uint32_t hz = FREQ_HZ[set.par[CH_WIND][P_FREQ]] / 2u + 120u;
        int32_t wob;
        wind_ph += 3u + (uint32_t)(squall >> 12);
        wob = sine(wind_ph << 20) / 2 + drift[CH_WIND] / 2;
        hz = (uint32_t)((int32_t)hz + (int32_t)hz * wob / 65536 * (1 + (gale + squall) / 16384));
        if (hz < 120u) hz = 120u;
        if (hz > 3500u) hz = 3500u;
        c_wind_f = (int32_t)(hz * 4669u / 1000u);
        c_wind_q = 20000 - gale / 4 - squall / 3;
        c_wind_amp = 20000 + wob / 3 + squall / 4;
    }
    {                                           /* water: rain density, the ocean's swell (~10 s) */
        uint32_t body = set.par[CH_WATER][P_FREQ];
        c_rain_p = (40u + body * 3u) * 9739u;
        ocean_ph += 1u;
        c_ocean_amp = 18000 + sine(ocean_ph * 1800000u) / 3 + drift[CH_WATER] / 8;
        c_ocean_k = onepole_k(250u + body * 4u + (uint32_t)(sine(ocean_ph * 1800000u) + 32767) / 160u);
    }
    {                                           /* earth (web makeEarth): loam -> crystal opens the low-pass, thins the sub */
        int32_t t = (int32_t)set.par[CH_EARTH][P_TYPE] * 258, body = set.par[CH_EARTH][P_FREQ];   /* t: Q15 0..1 */
        uint32_t hz = (uint32_t)(90 + (320 * t >> 15)) * (uint32_t)(60 + body * 100 / 127) / 100u;
        uint32_t qx1000 = (uint32_t)(1500 - (850 * t >> 15));
        c_earth_f = (int32_t)(hz * 4669u / 1000u);
        c_earth_q = (int32_t)(32768000u / qx1000);
        c_earth_inc = hz_inc(32u + (uint32_t)body / 10u);           /* the sub: 32 .. 44 Hz (web: 38) */
        c_earth_sub = 13000 * (32768 - (26870 * t >> 15)) >> 15;  /* x (1 - 0.82 t) */
        c_earth_noise = 32767;
        swell_ph += 5497558u;                                       /* 0.04 Hz at one step per 32 ms */
        c_earth_swell = 26000 + (sine(swell_ph) * (7400 - (4440 * t >> 15)) >> 15);
    }
    {                                           /* macros: tilt, space (FX swells it), pulse */
        int32_t t = (int32_t)set.macro[0] - 64, sp = set.macro[2];
        if (swell) { t = t + 30 > 63 ? 63 : t + 30; sp = 127; }
        if (t < 0) { c_tilt_a = 32767; c_tilt_b = 32767 + t * 480; }
        else { c_tilt_a = 32767 - t * 200; c_tilt_b = 32767 + t * 300; }
        c_space = sp * 258;
        c_fb = swell ? 30000 : 26000 + sp * 20;
        c_pulse_inc = set.macro[3] ? PULSE_INC[set.macro[3]] : 0u;
    }
    c_master = paused ? 0 : 32767;
}

static void drift_step(void)                    /* every ~32 ms: a slow random walk per channel */
{
    uint32_t c;
    for (c = 0; c < NCH; c++) {
        dvel[c] += (int32_t)(rnd() >> 22) - 512 - dvel[c] / 16 - drift[c] / 2048;
        drift[c] += dvel[c] / 4;
        if (drift[c] > 32767) { drift[c] = 32767; dvel[c] = -dvel[c] / 2; }
        if (drift[c] < -32767) { drift[c] = -32767; dvel[c] = -dvel[c] / 2; }
    }
}

static void apply_intent(uint32_t i)
{
    uint32_t c, k;
    set.intent = (uint8_t)i;
    for (c = 0; c < NCH; c++) {
        set.on[c] = 0;
        for (k = 0; k < NPAR; k++) set.par[c][k] = PAR_DEFAULT[c][k];
    }
    for (k = 0; k < 4u; k++) {
        const mixpart_t *m = &INTENT_MIX[i][k];
        if (m->ch >= NCH) break;
        set.on[m->ch] = 1;
        set.par[m->ch][P_VOL] = m->vol;
        set.par[m->ch][P_FREQ] = m->freq;
        set.par[m->ch][P_TYPE] = m->type;
    }
    set.macro[3] = INTENT_PULSE[i];
    memset(next_ms, 0, sizeof next_ms);
}
static void shuffle(void)                       /* LFO: nudge every channel that is on (the web's randomize) */
{
    uint32_t c, k;
    for (c = 0; c < NCH; c++) {
        if (!set.on[c]) continue;
        for (k = 0; k < 3u; k++) {
            int32_t span = k == P_VOL ? 24 : k == P_FREQ ? 30 : 40, v = (int32_t)set.par[c][k] + (int32_t)rnd_n((uint32_t)span * 2u + 1u) - span;
            if (k == P_VOL && v < 24) v = 24;
            set.par[c][k] = (uint8_t)(v < 0 ? 0 : v > 127 ? 127 : v);
        }
    }
}
static void evolve_step(void)                   /* SEQ on: every 8-20 s, one channel moves a little */
{
    uint32_t c, tries;
    for (tries = 0; tries < 11u; tries++) {
        c = rnd_n(NCH);
        if (set.on[c]) {
            uint32_t k = rnd_n(3);
            int32_t v = (int32_t)set.par[c][k] + (int32_t)rnd_n(17) - 8;
            if (k == P_VOL && v < 20) v = 20;
            set.par[c][k] = (uint8_t)(v < 0 ? 0 : v > 127 ? 127 : v);
            return;
        }
    }
}

/* ================================================================== the screen */
static uint16_t rgb_of(uint32_t c, uint32_t bright)   /* the channel's colour (noise: morphed), bright 0..256 */
{
    uint32_t r = CH_RGB[c][0], gg = CH_RGB[c][1], b = CH_RGB[c][2];
    if (c < 3u) {
        uint32_t m = set.par[c][P_TYPE] * 2u;   /* 0..254 */
        r = (r * (256u - m) + PAIR_RGB[c][0] * m) >> 8;
        gg = (gg * (256u - m) + PAIR_RGB[c][1] * m) >> 8;
        b = (b * (256u - m) + PAIR_RGB[c][2] * m) >> 8;
    }
    return RGB(r * bright >> 8, gg * bright >> 8, b * bright >> 8);
}
static uint32_t lvl[NMETER];                    /* meters, 0..256, decayed */
static uint32_t held_black, spin_ph, bars_dirty;

/* the loop recorder's state (the loop itself is in set: it survives a power-off) */
static uint32_t rec_on, rec_t0, rec_n, loop_t0, loop_pos;
static uint32_t rec_ev[NLOOP];

/* ripples: a strike sends a ring out from the centre (ribbon / puddle's ripples, in pixels) */
#define NRIP 8u
static struct { int16_t r; uint8_t life, slot; } rip[NRIP];
static uint32_t rip_i;
static void ripple(uint32_t slot) { rip[rip_i].r = 10; rip[rip_i].life = 40; rip[rip_i].slot = (uint8_t)slot; rip_i = (rip_i + 1u) % NRIP; }

/* the trigrams (bit 0 = the bottom line, 1 = solid): the elements and the ones they morph into (the web's TONES) */
enum { TG_KUN, TG_ZHEN, TG_KAN, TG_DUI, TG_GEN, TG_LI, TG_XUN, TG_QIAN };
static const uint8_t TG_LINES[8] = {0, 1, 2, 3, 4, 5, 6, 7};   /* Kun 000 Zhen 100 Kan 010 Dui 110 Gen 001 Li 101 Xun 011 Qian 111 */
static const uint8_t ELEM_TG[4][2] = {{TG_LI, TG_ZHEN}, {TG_XUN, TG_DUI}, {TG_KAN, TG_GEN}, {TG_KUN, TG_QIAN}};
static void draw_trigram(int32_t cx, int32_t cy, uint32_t tg, int32_t w, uint16_t col)
{
    uint32_t l;
    for (l = 0; l < 3u; l++) {                  /* the bottom line at the bottom */
        int32_t y = cy + 4 - (int32_t)l * 4;
        if (TG_LINES[tg] >> l & 1u) cv_rect(cx - w / 2, y, w, 2, col);
        else { cv_rect(cx - w / 2, y, w / 2 - 1, 2, col); cv_rect(cx + 2, y, w / 2 - 1, 2, col); }
    }
}

static uint16_t slot_rgb(uint32_t slot, uint32_t bright)
{
    return slot < NCH ? rgb_of(slot, bright) : RGB(220 * bright >> 8, 200 * bright >> 8, 255 * bright >> 8);
}

static void draw_ring(void)
{
    enum { CX = 120, CY = 88, R0 = 56, NSEG = 88, NROSE = 72 };
    int32_t px = 0, py = 0;
    uint32_t j, c, non = 0, dom = NCH, domv = 0, sum = 0;
    cv_begin(240, 176, C_BLACK);
    for (c = 0; c < NCH; c++)
        if (set.on[c]) { non++; sum += lvl[c]; if (lvl[c] >= domv) { domv = lvl[c]; dom = c; } }
    for (j = 0; j < NRIP; j++) {                /* the ripples, behind everything */
        uint32_t s, life = rip[j].life;
        if (!life) continue;
        for (s = 0; s < 64u; s++) {
            uint32_t ph = s << 26;
            int32_t x = CX + (sine(ph + 0x40000000u) * rip[j].r >> 15), y = CY + (sine(ph) * rip[j].r >> 15);
            if (y >= 0 && y < 176) cv_pset(x, y, slot_rgb(rip[j].slot, life * 5u));
        }
        rip[j].r = (int16_t)(rip[j].r + 3);
        rip[j].life--;
    }
    if (non && !paused) {                       /* the rosette: one petal pair per channel that is on */
        uint32_t k = non < 2u ? 2u : non, rr = 12u + sum / 40u + lvl[CH_STRIKE] / 12u;
        uint16_t col = slot_rgb(dom, 90u + domv / 3u);
        if (rr > 46u) rr = 46u;
        for (j = 0; j <= NROSE; j++) {
            uint32_t ph = (j % NROSE) * (0xFFFFFFFFu / NROSE), pp = ph * k + (spin_ph >> 1);
            int32_t a = sine(pp), r = (int32_t)rr * (a < 0 ? -a : a) >> 15, x, y;
            x = CX + (sine(ph + 0x40000000u) * r >> 15);
            y = CY + (sine(ph) * r >> 15);
            if (j) cv_line(px, py, x, y, col);
            px = x; py = y;
        }
    }
    for (j = 0; j <= NSEG; j++) {               /* the ring: bumps and spokes where loud channels sit */
        uint32_t jj = j % NSEG, ph = jj * (0xFFFFFFFFu / NSEG) + spin_ph, best = 0, bc = NCH;
        int32_t r = R0, x, y;
        for (c = 0; c < NCH; c++) {
            int32_t pos = (int32_t)(c * NSEG / NCH), d = (int32_t)jj - pos;
            if (d < 0) d = -d;
            if (d > NSEG / 2) d = NSEG - d;
            if (d < 6 && set.on[c]) {
                uint32_t a = lvl[c] * (uint32_t)(6 - d) / 6u;
                r += (int32_t)(a / 9u);
                if (a > best) { best = a; bc = c; }
            }
        }
        r += (int32_t)(lvl[CH_STRIKE] / 24u);
        x = CX + (sine(ph + 0x40000000u) * r >> 15);
        y = CY + (sine(ph) * r >> 15);
        if (j) {
            uint16_t col = bc < NCH ? rgb_of(bc, 140u + best / 2u) : RGB(70, 70, 80);
            cv_line(px, py, x, y, col);
            cv_line(px + 1, py, x + 1, y, col);     /* two pixels wide */
            if (best > 24u && (jj & 1u)) {          /* a spoke inward: the spectrum-bar layer */
                int32_t ri = r - 2 - (int32_t)(best / 10u);
                cv_line(x, y, CX + (sine(ph + 0x40000000u) * ri >> 15), CY + (sine(ph) * ri >> 15), rgb_of(bc, 60u + best / 3u));
            }
        }
        px = x; py = y;
    }
    for (c = 0; c < NCH; c++) {                 /* the channels around it: dots, the elements as their trigram */
        uint32_t ph = c * (0xFFFFFFFFu / NCH) + spin_ph;
        int32_t r = R0 + 22, x = CX + (sine(ph + 0x40000000u) * r >> 15), y = CY + (sine(ph) * r >> 15);
        int32_t s = set.on[c] ? 2 + (int32_t)(lvl[c] / 48u) : 1;
        uint16_t col = set.on[c] ? rgb_of(c, 256) : RGB(50, 50, 56);
        if (held_black >> c & 1u) cv_rect(x - 9, y - 9, 19, 19, RGB(60, 60, 70));
        if (c >= CH_FIRE) draw_trigram(x, y, ELEM_TG[c - CH_FIRE][set.par[c][P_TYPE] >= 64u], 10 + s, col);
        else cv_rect(x - s, y - s, 2 * s + 1, 2 * s + 1, col);
    }
    if (rec_on || (set.loop_on && set.loop_n)) {   /* the loop: a dot going round, red while recording */
        uint32_t len = rec_on ? 60000u : set.loop_len, pos = rec_on ? fm1_ms - rec_t0 : loop_pos;
        uint32_t ph = ((pos << 16) / (len ? len : 1u) << 16) - 0x40000000u;   /* (32-bit: pos <= 60 s) */
        int32_t r = R0 + 34, x = CX + (sine(ph + 0x40000000u) * r >> 15), y = CY + (sine(ph) * r >> 15);
        cv_rect(x - 2, y - 2, 5, 5, rec_on ? RGB(255, 60, 60) : RGB(230, 230, 240));
        cv_text(4, 2, &FONT_S, rec_on ? "rec" : "loop", rec_on ? RGB(255, 60, 60) : RGB(150, 150, 160));
    }
    {                                           /* centre: the intent */
        const char *s = paused ? "paused" : INTENT_NAME[set.intent % 6u];
        cv_text(CX - text_w(&FONT_S, s) / 2, CY - 8, &FONT_S, s, paused ? RGB(120, 120, 130) : RGB(230, 220, 255));
    }
    cv_blit(0, 0);
}

static void draw_bars(void)                     /* the bottom strip: what the four knobs move now */
{
    static const char *const MLAB[4] = {"TILT", "DRIFT", "SPACE", "PULSE"};
    const char *lab[4] = {"LEVEL", "FREQ", "COLOR", "DRIFT"};
    uint8_t val[4];
    uint16_t col = RGB(200, 190, 255);
    char head[40];
    uint32_t k, c = NCH, n = 0;
    for (k = 0; k < NCH; k++) if (held_black >> k & 1u) { c = k; break; }
    cv_begin(240, 64, C_BLACK);
    if (c < NCH) {
        const char *nm = CH_NAME[c], *ty = 0;
        for (k = 0; k < 4u; k++) val[k] = set.par[c][k];
        if (c < 3u && set.par[c][P_TYPE] > 63u) ty = PAIR_NAME[c];
        if (c >= CH_BELL && c <= CH_BIRDS) { lab[1] = "RATE"; lab[2] = "REG"; }
        if (c >= CH_FIRE) { lab[1] = "BODY"; lab[2] = "TYPE"; ty = TYPE_NAME[c - CH_FIRE][(set.par[c][P_TYPE] * 3u) / 128u]; }
        while (*nm && n < 20u) head[n++] = *nm++;
        if (ty) { head[n++] = ' '; head[n++] = '>'; head[n++] = ' '; while (*ty && n < 38u) head[n++] = *ty++; }
        if (!set.on[c]) { const char *o = "  (off)"; while (*o && n < 38u) head[n++] = *o++; }
        head[n] = 0;
        col = rgb_of(c, 256);
    } else {
        static const char *const NOTE[12] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
        const char *nm = NOTE[(uint32_t)(root_note() % 12)];
        int32_t o = (int8_t)set.oct;
        for (k = 0; k < 4u; k++) { val[k] = set.macro[k]; lab[k] = MLAB[k]; }
        { const char *p = "root "; while (*p) head[n++] = *p++; }
        while (*nm) head[n++] = *nm++;
        { const char *p = "  oct "; while (*p) head[n++] = *p++; }
        head[n++] = o < 0 ? '-' : '+'; head[n++] = (char)('0' + (o < 0 ? -o : o));
        if (evolve) { const char *p = "  evolve"; while (*p) head[n++] = *p++; }
        if (set.loop_n) {                       /* the loop's length, x.y s */
            uint32_t ds = set.loop_len / 100u;
            const char *p = set.loop_on ? "  loop " : "  (loop ";
            while (*p) head[n++] = *p++;
            if (ds >= 100u) head[n++] = (char)('0' + ds / 100u);
            head[n++] = (char)('0' + ds / 10u % 10u); head[n++] = '.'; head[n++] = (char)('0' + ds % 10u); head[n++] = 's';
            if (!set.loop_on) head[n++] = ')';
        }
        head[n] = 0;
    }
    cv_text(6, 2, &FONT_S, head, col);
    for (k = 0; k < 4u; k++) {
        int32_t x = 6 + (int32_t)k * 58, w = (int32_t)val[k] * 52 / 127;
        cv_text(x, 22, &FONT_S, lab[k], RGB(120, 120, 135));
        cv_rect(x, 44, 52, 10, RGB(30, 30, 40));
        cv_rect(x, 44, w, 10, col);
    }
    cv_blit(0, 176);
}

/* ================================================================== the actions: played live or by the loop */
enum { EV_DOWN, EV_UP, EV_ON, EV_VOL, EV_FREQ, EV_TYPE, EV_DRIFT, EV_MACRO };
enum { TB_BIRDS = 4 };

static void rec_put(uint32_t ty, uint32_t a, uint32_t b)
{
    uint32_t t = fm1_ms - rec_t0, ev;
    if (!rec_on || t > 60000u) return;
    ev = t | ty << 16 | (a & 31u) << 19 | (b & 255u) << 24;
    if (ty >= EV_VOL && rec_n) {                /* a knob turning: keep one event per 40 ms */
        uint32_t last = rec_ev[rec_n - 1u];
        if ((last >> 16 & 0xFFu) == (ev >> 16 & 0xFFu) && t - (last & 0xFFFFu) < 40u) { rec_ev[rec_n - 1u] = ev; return; }
    }
    if (rec_n < NLOOP) rec_ev[rec_n++] = ev;
}

static void act_down(uint32_t k, uint32_t tb, uint32_t from_loop)   /* a white key: strike */
{
    int32_t note = penta_note(root_note() - 12 + 12 * (int8_t)set.oct, (int32_t)k), lev = 18000;
    uint32_t slot = CH_STRIKE;
    if (!from_loop) rec_put(EV_DOWN, k, tb);
    if (tb == TB_BIRDS) {
        uint32_t hz = FREQ_HZ[60 + k * 3u] * 2u;
        chirp(hz, hz * (70u + rnd_n(80)) / 100u, 60u + rnd_n(60), 12000, DEC32[8], CH_BIRDS);
        ripple(CH_BIRDS);
        return;
    }
    if (tb == TB_GONG) { note -= 24; slot = CH_GONG; }
    else if (tb == TB_CHIME) { note += 12; slot = CH_CHIME; lev = 14000; }
    else if (tb == TB_BELL) slot = CH_BELL;
    key_voice[from_loop][k] = (int8_t)strike(tb, note, lev, 8192u + k * 3200u, slot, 1u + k + 16u * from_loop);
    if (!from_loop) lit_white |= 1u << k;
}
static void act_up(uint32_t k, uint32_t from_loop)
{
    int32_t v = key_voice[from_loop][k];
    if (!from_loop) { rec_put(EV_UP, k, 0); lit_white &= ~(1u << k); }
    if (v >= 0 && mv[v].owner == 1u + k + 16u * from_loop) mv[v].held = 0;   /* (unless another strike took the voice) */
    key_voice[from_loop][k] = -1;
}
static void act_on(uint32_t c, uint32_t on, uint32_t from_loop)
{
    if (!from_loop) rec_put(EV_ON, c, on);
    set.on[c] = (uint8_t)on;
    if (c >= CH_BELL && c <= CH_BIRDS) next_ms[c - CH_BELL] = on ? fm1_ms : 0;
    bars_dirty = 1;
}
static void act_par(uint32_t c, uint32_t k, uint32_t v, uint32_t from_loop)
{
    if (!from_loop) rec_put(EV_VOL + k, c, v);
    set.par[c][k] = (uint8_t)v;
    bars_dirty = 1;
}
static void act_macro(uint32_t k, uint32_t v, uint32_t from_loop)
{
    if (!from_loop) rec_put(EV_MACRO, k, v);
    set.macro[k] = (uint8_t)v;
    bars_dirty = 1;
}

static void loop_release_all(void)
{
    uint32_t k;
    for (k = 0; k < 16u; k++) if (key_voice[1][k] >= 0) act_up(k, 1);
}
static void rec_start(void) { rec_on = 1; rec_t0 = fm1_ms; rec_n = 0; }
static void rec_stop(uint32_t held_ms)          /* REC let go: a new loop, or tap = loop on/off, long hold = clear */
{
    uint32_t len = fm1_ms - rec_t0, k;
    rec_on = 0;
    if (!rec_n) {
        if (held_ms >= 1500u) { loop_release_all(); set.loop_n = 0; set.loop_on = 0; }
        else if (held_ms < 600u && set.loop_n) { set.loop_on = !set.loop_on; loop_t0 = fm1_ms; loop_pos = 0; if (!set.loop_on) loop_release_all(); }
        bars_dirty = dirty = 1;
        return;
    }
    if (len > 60000u) len = 60000u;
    if (len < 250u) len = 250u;
    for (k = 0; k < 16u && rec_n < NLOOP; k++)  /* keys still down when REC went up: let go at the loop's end */
        if (key_voice[0][k] >= 0 && fm1_in.notes >> WHITE_KEY[k] & 1u)
            rec_ev[rec_n++] = (len - 1u) | (uint32_t)EV_UP << 16 | k << 19;
    loop_release_all();
    memcpy(set.loop_ev, rec_ev, rec_n * 4u);
    set.loop_n = (uint16_t)rec_n;
    set.loop_len = (uint16_t)len;
    set.loop_on = 1;
    loop_t0 = fm1_ms;
    loop_pos = 0;
    bars_dirty = dirty = 1; t_change = fm1_ms;
}
static void loop_play(uint32_t from, uint32_t to)   /* the events in (from, to], to < loop_len; from = ~0: from the start */
{
    uint32_t i;
    for (i = 0; i < set.loop_n; i++) {
        uint32_t ev = set.loop_ev[i], t = ev & 0xFFFFu, ty = ev >> 16 & 7u, a = ev >> 19 & 31u, b = ev >> 24;
        if (!((from == ~0u ? 1 : t > from) && t <= to)) continue;
        switch (ty) {
        case EV_DOWN: if (a < 16u) act_down(a, b, 1); break;
        case EV_UP: if (a < 16u) act_up(a, 1); break;
        case EV_ON: if (a < NCH) act_on(a, b & 1u, 1); break;
        case EV_MACRO: if (a < 4u) act_macro(a, b & 127u, 1); break;
        default: if (a < NCH) act_par(a, ty - EV_VOL, b & 127u, 1); break;
        }
    }
}
static void loop_tick(void)
{
    uint32_t pos;
    if (!set.loop_on || !set.loop_n || !set.loop_len || paused) return;
    pos = (fm1_ms - loop_t0) % set.loop_len;
    if (pos < loop_pos) { loop_play(loop_pos, set.loop_len); loop_play(~0u, pos); }   /* wrapped round */
    else if (pos != loop_pos) loop_play(loop_pos, pos);
    loop_pos = pos;
}

/* ================================================================== MIDI in: notes strike */
static uint32_t idle_ok;
static void midi_in(void)
{
    uint8_t st, d1, d2;
    while (midi_get(&st, &d1, &d2) != 0) {
        uint32_t ty = st & 0xF0u;
        if (st >= 0xF0u) continue;
        if (ty == 0x90u && d2) strike(TB_KEY, d1, (int32_t)d2 * 200, 16384u + rnd_n(32768), CH_STRIKE, 0);
    }
}
static void app_idle(void) { if (idle_ok) midi_in(); }

static int quiet(void)                          /* paused and the fade is done: safe to erase flash */
{
    return paused && meter[CH_PINK] < 8u && meter[CH_STRIKE] < 8u && meter[CH_WATER] < 8u && meter[CH_EARTH] < 8u;
}

static uint32_t clamp127(int32_t v) { return (uint32_t)(v < 0 ? 0 : v > 127 ? 127 : v); }

static void app_main(void)
{
    uint32_t prev = 0, k, c, t_drift = 0, t_draw = 0, t_evolve = 0, touched = 0, rec_down_ms = 0;
    uint32_t bars_key = ~0u;
    memset(key_voice, -1, sizeof key_voice);
    if (settings_load(&set, sizeof set) || set.ver != SET_VER || set.intent > 5u || set.loop_n > NLOOP) {
        memset(&set, 0, sizeof set);
        set.ver = SET_VER;
        set.macro[0] = 64; set.macro[1] = 64; set.macro[2] = 48;
        apply_intent(0);
    }
    if ((int8_t)set.oct < -2 || (int8_t)set.oct > 2) set.oct = 0;
    if (set.root < -12 || set.root > 12) set.root = 0;
    rnd_s ^= fm1_ms | 1u;
    loop_t0 = fm1_ms;

    lcd_fill(0, 0, 240, 240, C_BLACK);
    update_controls();

    for (;;) {
        uint32_t keys, down, up, rel, b, btn;
        int32_t e;
        platform_poll();
        rnd_s += fm1_ms;

        /* ---- the keys */
        keys = fm1_in.notes;
        down = keys & ~prev;
        up = prev & ~keys;
        prev = keys;
        btn = fm1_in.buttons;
        for (c = 0; c < NCH; c++) {
            uint32_t bit = 1u << BLACK_KEY[c];
            if (down & bit) { held_black |= 1u << c; touched &= ~(1u << c); }
            if (up & bit) {
                held_black &= ~(1u << c);
                if (!(touched >> c & 1u)) { act_on(c, !set.on[c], 0); dirty = 1; t_change = fm1_ms; }
            }
        }
        for (k = 0; k < 16u; k++) {
            uint32_t bit = 1u << WHITE_KEY[k];
            if (down & bit) {
                uint32_t tb = TB_KEY;
                if (btn & (1u << BTN_HOME)) {
                    if (k < 6u) { apply_intent(k); bars_dirty = dirty = 1; t_change = fm1_ms; }
                    continue;
                }
                if (held_black & (1u << CH_BIRDS)) tb = TB_BIRDS;
                else if (held_black & (1u << CH_GONG)) tb = TB_GONG;
                else if (held_black & (1u << CH_CHIME)) tb = TB_CHIME;
                else if (held_black & (1u << CH_BELL)) tb = TB_BELL;
                touched |= held_black;          /* a key held for a strike is not a tap */
                act_down(k, tb, 0);
            }
            if (up & bit) act_up(k, 0);
        }

        /* ---- the buttons */
        b = fm1_input_edges(&rel);
        if (b & (1u << BTN_PLAY)) { paused = !paused; t_change = fm1_ms; if (!paused) { loop_t0 = fm1_ms - loop_pos; } }
        if (b & (1u << BTN_REC)) { rec_down_ms = fm1_ms; rec_start(); }
        if (rel & (1u << BTN_REC) && rec_on) rec_stop(fm1_ms - rec_down_ms);
        if (b & (1u << BTN_LFO)) { shuffle(); bars_dirty = dirty = 1; t_change = fm1_ms; }
        if (b & (1u << BTN_SEQ)) { evolve = !evolve; t_evolve = fm1_ms + 8000u + rnd_n(12000); bars_dirty = 1; }
        if (b & (1u << BTN_OCT_DOWN) && (int8_t)set.oct > -2) { set.oct = (uint8_t)((int8_t)set.oct - 1); dirty = 1; t_change = fm1_ms; }
        if (b & (1u << BTN_OCT_UP) && (int8_t)set.oct < 2) { set.oct = (uint8_t)((int8_t)set.oct + 1); dirty = 1; t_change = fm1_ms; }
        swell = (btn >> BTN_FX) & 1u;

        /* ---- the knobs */
        for (k = 0; k < 4u; k++) {
            if ((e = fm1_enc_take(ENC_KNOB1 + k)) == 0) continue;
            if (e > 1 || e < -1) e *= 2;        /* fast turns go further */
            if (held_black) {
                for (c = 0; c < NCH; c++) {
                    if (!(held_black >> c & 1u)) continue;
                    act_par(c, k, clamp127((int32_t)set.par[c][k] + e), 0);
                    if (!set.on[c]) act_on(c, 1, 0);
                    touched |= 1u << c;
                }
            } else act_macro(k, clamp127((int32_t)set.macro[k] + e), 0);
            dirty = 1; t_change = fm1_ms;
        }
        if ((e = fm1_enc_take(ENC_PRESETS)) != 0) {
            int32_t i = ((int32_t)set.intent + (e > 0 ? 1 : -1) + 6) % 6;
            apply_intent((uint32_t)i); bars_dirty = dirty = 1; t_change = fm1_ms;
        }
        if ((e = fm1_enc_take(ENC_SELECT)) != 0) {
            int32_t r = set.root + e;
            set.root = (int8_t)(r < -12 ? -12 : r > 12 ? 12 : r); bars_dirty = dirty = 1; t_change = fm1_ms;
        }
        if ((e = fm1_enc_take(ENC_ALGORITHM)) != 0) {
            int32_t s = (int32_t)set.spin + e;
            set.spin = (uint8_t)(s < 0 ? 0 : s > 40 ? 40 : s); dirty = 1; t_change = fm1_ms;
        }

        midi_in();
        loop_tick();
        schedule();
        if (fm1_ms - t_drift >= 32u) {
            t_drift = fm1_ms;
            drift_step();
            update_controls();
            for (c = 0; c < NMETER; c++) {      /* meters -> 0..256, fast up, slow down */
                uint32_t m = meter[c] >> 5, l = m > 256u ? 256u : m;
                meter[c] = 0;
                lvl[c] = l > lvl[c] ? l : lvl[c] - (lvl[c] >> 3);
            }
        }
        if (evolve && !paused && (int32_t)(fm1_ms - t_evolve) >= 0) { t_evolve = fm1_ms + 8000u + rnd_n(12000); evolve_step(); bars_dirty = 1; }

        /* ---- the lights */
        for (c = 0; c < NCH; c++) fm1_led_key(KEY_LED(BLACK_KEY[c]), set.on[c]);
        for (k = 0; k < 16u; k++) fm1_led_key(KEY_LED(WHITE_KEY[k]), lit_white >> k & 1u);
        fm1_led_key(BTN_PLAY, !paused);
        fm1_led_key(BTN_SEQ, evolve);
        fm1_led_key(BTN_FX, swell);
        fm1_led_key(BTN_REC, rec_on ? 1 : (set.loop_on && set.loop_n && loop_pos < 120u));   /* lit: recording; a blink a loop */
        fm1_led_key_glow(BTN_REC, set.loop_n != 0);
        fm1_led_key(BTN_OCT_DOWN, (int8_t)set.oct < 0);
        fm1_led_key(BTN_OCT_UP, (int8_t)set.oct > 0);

        /* ---- the screen, ~20 frames a second */
        if (fm1_ms - t_draw >= 50u) {
            uint32_t bk = held_black | (uint32_t)set.oct << 12 | (uint32_t)(uint8_t)set.root << 16 | evolve << 24 | rec_on << 25;
            t_draw = fm1_ms;
            spin_ph += (2u + set.spin) * 600000u;
            idle_ok = 1;
            draw_ring();
            if (bk != bars_key || bars_dirty) { bars_key = bk; bars_dirty = 0; draw_bars(); }
            idle_ok = 0;
        }

        if (dirty && quiet() && !rec_on && fm1_ms - t_change > 2000u) {   /* save only when paused and faded (an erase stalls the sound) */
            settings_save(&set, sizeof set);
            dirty = 0;
        }
    }
}
