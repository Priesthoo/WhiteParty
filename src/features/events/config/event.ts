export const EVENT_START_AT =
  "2026-12-11T20:00:00+01:00";

export const eventConfig = {
  name: "ALL WHITE POOL PARTY",

  organizer: "ZIMJA FEST",

  presentedBy: "TINOTENDA MEDIA LIMITED",

  dateLabel: "Friday, December 11, 2026",

  timeLabel: "8:00 PM",

  venue:
    "2, Lanre Laogoshe Close, off Etal Avenue, Oregun, Ikeja",

  venueLandmark:
    "In front of NNPC, First Bank Bus Stop",

  slogan: "PARTY TILL MAMA CALLS",

  contact: {
    sponsorship: "+234 812 156 7008",
    enquiries: "+234 916 524 5102",
  },

  tickets: {
    "early-bird": {
      id: "early-bird",
      name: "Early Bird",
      priceNaira: 3000,
      admissionsPerUnit: 1,
    },

    regular: {
      id: "regular",
      name: "Regular",
      priceNaira: 5000,
      admissionsPerUnit: 1,
    },

    "friends-of-five": {
      id: "friends-of-five",
      name: "Friends of 5",
      priceNaira: 20000,
      admissionsPerUnit: 5,
    },
  },

  limits: {
    earlyBirdAdmissions: 30,
  },
} as const;

export type TicketTypeId =
  keyof typeof eventConfig.tickets;