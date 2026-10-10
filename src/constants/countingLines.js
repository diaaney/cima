const WRONG_NUMBER_LINES = [
    'lmao {user} typed **{got}** when we needed **{expected}**. count died at **{reached}**, back to 1',
    '{user} cooked the whole count. expected **{expected}**, got **{got}**. we\'re at 0 thanks to you',
    'imagine reaching **{reached}** just to fumble at **{expected}**. embarrassing {user}',
    '{user} can\'t count past **{reached}** apparently. it was **{expected}** not **{got}**. reset.',
    'the count was **{reached}** strong and {user} said "nah". next number: **1**',
    '{user} really typed **{got}** with their full chest. it was **{expected}**. start over',
    'rip the **{reached}** streak, {user} just clicked it off. back to 1',
    'bro {user} thinks **{got}** comes after **{reached}**. school was free',
    '{user} just deleted **{reached}** counts of teamwork. expected **{expected}**, got **{got}**',
    'nobody asked {user} to math but here we are. count: **0**. next: **1**',
    '{user} the count was literally **{reached}**. how do you type **{got}**',
    'expected **{expected}**. {user} typed **{got}**. count: gone. confidence: also gone',
    '{user} fumbled at **{expected}** harder than i\'ve ever seen. back to 1',
    'how do you mess up **{expected}** {user}. it\'s right there. count reset',
    '{user} just performed a count-icide on **{reached}** numbers. start again',
    'fun fact: **{expected}** ≠ **{got}**. blame {user} for the reset',
    '{user} typed **{got}** like they were sure. they were not. back to 1',
    '**{reached}** numbers of progress gone because {user} can\'t count. expected **{expected}**',
    '{user} the next number was **{expected}**. you wrote **{got}**. read the room',
    'count restart sponsored by {user} typing **{got}** instead of **{expected}**'
];

const BOOSTER_WIN_LINES = [
    'ok {user} actually did `{expression}` = **{answer}**. count goes **{from}** → **{to}** ({type})',
    'shocking. {user} can math. count yeeted from **{from}** to **{to}**',
    '{user} solved it in like 2 seconds and {type}\'d the whole count to **{to}**',
    'proud of {user} ngl. **{answer}** was right. count: **{from}** → **{to}**',
    '{user} just speedran `{expression}` and the count jumped to **{to}**. cracked',
    'bet nobody expected {user} to know **{answer}**. count: **{to}** ({type})',
    'somehow {user} pulled **{answer}** out of nowhere. count slapped with {type} → **{to}**',
    '{user} the human calculator. **{from}** is now **{to}**. carry on',
    'ok genius {user}. `{expression}` = **{answer}** confirmed. count: **{to}**',
    '{user} earned the count a {type}. **{from}** → **{to}**. peasants keep counting',
    'wasn\'t expecting {user} to actually solve `{expression}` but here we are. **{to}**',
    '{user} clocked **{answer}** like it owed them money. count jumped to **{to}**',
    '{user} did the math while you were sleeping. count is now **{to}**',
    '{type} secured by {user}. count walks tall at **{to}**',
    '{user} actually read the question. count: **{from}** → **{to}**. respect.'
];

const BOOSTER_FAIL_LINES = [
    '{user} typed **{guess}** for `{expression}`. it was **{answer}**. embarrassing. count untouched',
    'imagine claiming and then writing **{guess}**. it was **{answer}** {user}. shameful',
    '{user} clicked claim with the confidence of someone who knows math. they don\'t. answer was **{answer}**',
    'not **{guess}** {user}. **{answer}**. did you even look at `{expression}`',
    '{user} just lost the booster for the whole channel. answer was **{answer}**, not **{guess}**',
    'catastrophic. {user} thought **{guess}**. it was **{answer}**. count gets nothing',
    '{user} the calculator is free. **{guess}** is not **{answer}**. booster wasted',
    'bro {user} claimed it just to type **{guess}**. it was **{answer}**. why',
    '{user} fumbled a free boost. **{answer}**, not **{guess}**. count stays',
    '{user} solved `{expression}` like a goldfish. answer: **{answer}**. yours: **{guess}**',
    'devastating loss for {user}. the answer was **{answer}**. you typed **{guess}**. count: cope',
    '{user} claimed the booster and threw the game. **{answer}**, not **{guess}**',
    'somewhere a math teacher is crying because {user} typed **{guess}** instead of **{answer}**',
    '{user} could\'ve boosted the count. instead they wrote **{guess}**. it was **{answer}**',
    'clown moment from {user}. **{guess}** ≠ **{answer}**. count gets nothing'
];

const SHIELD_SAVE_LINES = [
    '🛡 {saver} took the hit. {fumbler} typed **{got}** but the shield said no. count holds at **{n}**',
    '🛡 saved by {saver}\'s shield. {fumbler} would\'ve nuked **{n}** but math has a guardian today',
    '🛡 {saver} just ate one shield to clean up {fumbler}\'s mess. count: **{n}**',
    '🛡 thanks to {saver}, the count survives at **{n}**. {fumbler} should send a thank-you note',
    '🛡 {fumbler} tried it. {saver}\'s shield said "not today". count locked at **{n}**',
    '🛡 the count was about to die at **{n}**. {saver}\'s shield kept it alive. {fumbler} cope',
    '🛡 {saver} carried this server. {fumbler} fumbled, shield absorbed, count is **{n}**',
    '🛡 a shield from {saver} just paid for {fumbler}\'s mistake. count: **{n}**',
    '🛡 {fumbler} embarrassed themselves. {saver} bailed them out. count **{n}**',
    '🛡 incredible save by {saver}. {fumbler} typed **{got}** and learned nothing. count **{n}**',
];

const SABOTAGE_FUMBLE_LINES = [
    '💣 {user} was sabotaged. wrote **{got}** like a plain number. count is gone, idiot. expected **{expected}**',
    '💣 sabotaged {user} fell for it. you had to write math. **{got}** doesn\'t count. reset',
    '💣 {user} forgot they were sabotaged. typing **{got}** killed the count. expected something like `{example}`',
    '💣 imagine being sabotaged and still writing **{got}**. {user} the math was the assignment. count reset',
    '💣 {user} was supposed to flex with math. instead typed **{got}**. count: dead',
    '💣 sabotage worked perfectly on {user}. **{got}** is not how this works. expected `{example}`',
    '💣 {user} took the bait. plain **{got}** = reset. should\'ve done `{example}`',
    '💣 the sabotage was clear and {user} still wrote **{got}**. respectfully, l',
    '💣 {user} just confirmed the sabotage. **{got}** is not math. count: gone',
    '💣 nobody told {user} that sabotaged = use math. they wrote **{got}**. now nobody has a count',
];

const DROP_WIN_LINES = [
    '🎁 {user} cracked `{expression}` = **{answer}** and pocketed a {emoji} **{label}**',
    '🎁 {user} just won a {emoji} **{label}**. inventory growing',
    '🎁 the {emoji} **{label}** belongs to {user} now. earned it with **{answer}**',
    '🎁 {user} solved it first and the {emoji} **{label}** is theirs. nice',
    '🎁 a {emoji} **{label}** finds a home in {user}\'s loot. `{expression}` = **{answer}**',
    '🎁 {user} clocked **{answer}** and snagged the {emoji} **{label}**. use it well',
    '🎁 {emoji} **{label}** → {user}. paid the toll with `{expression}` = **{answer}**',
    '🎁 {user} earned a {emoji} **{label}**. don\'t fumble it',
    '🎁 the count is generous to {user} today. {emoji} **{label}** acquired',
    '🎁 {user} read `{expression}` and said **{answer}** without flinching. {emoji} **{label}** in the bag',
];

const DROP_FAIL_LINES = [
    '🎁❌ {user} fumbled `{expression}`. answer was **{answer}**, they typed **{guess}**. item lost to the void',
    '🎁❌ no loot for {user}. **{guess}** ≠ **{answer}**',
    '🎁❌ {user} threw a free {emoji} **{label}** in the trash by typing **{guess}**',
    '🎁❌ devastating. {user} typed **{guess}**. the {emoji} **{label}** evaporates',
    '🎁❌ {user} claimed it just to mess it up. answer was **{answer}**',
    '🎁❌ the {emoji} **{label}** would\'ve been yours {user}. you wrote **{guess}**. catastrophic',
    '🎁❌ {user} fumbled the loot. **{answer}**, not **{guess}**. better luck next drop',
    '🎁❌ {user}\'s math teacher is somewhere crying. expected **{answer}**, got **{guess}**',
    '🎁❌ the item vanishes. {user} typed **{guess}** for `{expression}`. answer was **{answer}**',
    '🎁❌ {user} fumbled. **{guess}** is not **{answer}**. no item, no respect',
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
