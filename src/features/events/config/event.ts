export const EVENT_START_AT =
  "2026-12-13T20:00:00+01:00";

export const eventConfig = {
  name: "ALL WHITE POOL PARTY",

  organizer: "ZIMJA FEST",

  presentedBy: "TINOTENDA MEDIA LIMITED",

  dateLabel: "Sunday, December 13, 2026",

  timeLabel: "8:00 PM",

  venue: "Undisclosed",

  slogan: "PARTY TILL MAMA CALLS",

  contact: {
    sponsorship: "+234 812 156 7008",
    enquiries: "+234 916 524 5102",
  },

  tickets: {
    "early-bird": {
      id: "early-bird",
      name: "Early Bird",
      priceNaira: 4000,
      admissionsPerUnit: 1,
    },

    "regular": {
      id: "regular",
      name: "Regular",
      priceNaira: 8000,
      admissionsPerUnit: 1,
    },

    "friends-of-five": {
      id: "friends-of-five",
      name: "Friends of 5",
      priceNaira: 36000,
      admissionsPerUnit: 5,
    },
  },
} as const;

export type TicketTypeId =
  keyof typeof eventConfig.tickets;