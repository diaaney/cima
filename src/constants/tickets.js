const CATEGORY_ID = '1559226960532471878';
const STAFF_ROLE_IDS = Object.freeze([
    '1558404033616683078', // Staff
    '1558492238814777426', // Moderator
]);
const ADMIN_ROLE_ID = '1513566859214061648';

const TYPES = Object.freeze({
    general: { label: 'Soporte general', description: 'Dudas o problemas del servidor', emoji: '🛟' },
    usuarios: { label: 'Soporte a usuarios', description: 'Reportes o ayuda con otras personas', emoji: '👥' },
    staff: { label: 'Aplicaciones al staff', description: 'Postulaciones para el equipo', emoji: '🛡️' },
});

module.exports = { CATEGORY_ID, STAFF_ROLE_IDS, ADMIN_ROLE_ID, TYPES };
