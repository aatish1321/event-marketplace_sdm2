// Role values match the backend user model and JWT claims.
export const ROLES = { ATTENDEE: 'attendee', ORGANIZER: 'organizer', ADMIN: 'admin' }

export function getRoleHome(role) {
  switch (role) {
    case ROLES.ATTENDEE: return '/discover'
    case ROLES.ORGANIZER: return '/dashboard'
    case ROLES.ADMIN: return '/admin-logs'
    default: return null
  }
}
