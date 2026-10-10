const WRONG_NUMBER_LINES = [
    '{user} escribió **{got}**, pero tocaba **{expected}**. La cuenta llegó a **{reached}** y vuelve a empezar.',
    'La cuenta iba en **{reached}**. {user} puso **{got}** en lugar de **{expected}**. Volvemos al **1**.',
    'Ups, {user}: después de **{reached}** venía **{expected}**, no **{got}**. Cuenta reiniciada.',
    '{user} se saltó el **{expected}** y escribió **{got}**. La cuenta vuelve a **0**.',
    'Hasta aquí llegó la racha de **{reached}**. {user} escribió **{got}**; tocaba **{expected}**.',
];

const BOOSTER_WIN_LINES = [
    '⚡ {user} resolvió `{expression}` = **{answer}**. La cuenta pasa de **{from}** a **{to}** ({type}).',
    '⚡ Bien hecho, {user}. Potenciador {type} aplicado: **{from}** → **{to}**.',
    '⚡ {user} acertó **{answer}**. Ahora seguimos contando desde **{to}**.',
    '⚡ {user} resolvió el reto y consiguió {type}. La cuenta quedó en **{to}**.',
];

const BOOSTER_FAIL_LINES = [
    '❌ {user} respondió **{guess}**, pero `{expression}` daba **{answer}**. La cuenta no cambia.',
    '❌ El potenciador se perdió: {user} puso **{guess}** y la respuesta era **{answer}**.',
    '❌ Casi, {user}. La respuesta correcta era **{answer}**; el potenciador desapareció.',
    '❌ `{expression}` = **{answer}**, no **{guess}**. Seguimos contando igual.',
];

const SHIELD_SAVE_LINES = [
    '🛡 El escudo de {saver} salvó la cuenta. {fumbler} escribió **{got}**, pero seguimos en **{n}**.',
    '🛡 {saver} usó su escudo: el error de {fumbler} no reinició la cuenta. Seguimos en **{n}**.',
    '🛡 Tocaba **{expected}** y {fumbler} puso **{got}**. El escudo de {saver} mantuvo el **{n}**.',
    '🛡 Cuenta a salvo gracias a {saver}. {fumbler} falló, pero seguimos en **{n}**.',
];

const SABOTAGE_FUMBLE_LINES = [
    '💣 {user} estaba saboteado: escribió **{got}** como número. Tocaba usar una operación como `{example}`. Cuenta reiniciada.',
    '💣 El sabotaje atrapó a {user}. **{got}** no cuenta sin operación; volvemos al **1**.',
    '💣 {user} debía escribir una operación, por ejemplo `{example}`. Puso **{got}** y se reinició la cuenta.',
    '💣 {user} olvidó el sabotaje. La respuesta **{got}** necesitaba una operación; tocaba **{expected}**.',
];

const DROP_WIN_LINES = [
    '🎁 {user} resolvió `{expression}` = **{answer}** y ganó {emoji} **{label}**.',
    '🎁 {user} respondió **{answer}** primero. {emoji} **{label}** va a su inventario.',
    '🎁 Premio para {user}: {emoji} **{label}**. ¡Bien resuelto!',
    '🎁 {user} acertó el reto y se llevó {emoji} **{label}**.',
];

const DROP_FAIL_LINES = [
    '🎁❌ {user} respondió **{guess}**, pero `{expression}` daba **{answer}**. El objeto desapareció.',
    '🎁❌ Sin premio esta vez, {user}. Era **{answer}**, no **{guess}**.',
    '🎁❌ {emoji} **{label}** se perdió. {user} puso **{guess}** y la respuesta era **{answer}**.',
    '🎁❌ {user} falló el reto; el objeto vuelve a desaparecer. ¡Suerte con el próximo!',
];

function pickLine(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function fillTokens(line, tokens) {
    let result = line;
    for (const [key, value] of Object.entries(tokens)) {
        result = result.replaceAll(`{${key}}`, value);
    }
    return result;
}

module.exports = {
    WRONG_NUMBER_LINES,
    BOOSTER_WIN_LINES,
    BOOSTER_FAIL_LINES,
    SHIELD_SAVE_LINES,
    SABOTAGE_FUMBLE_LINES,
    DROP_WIN_LINES,
    DROP_FAIL_LINES,
    pickLine,
    fillTokens,
};
