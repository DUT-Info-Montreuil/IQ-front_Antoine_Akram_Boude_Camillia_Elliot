/** Styles partagés des écrans IQ (maquettes E2, E3). */

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-[filter,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iq-mousse"

export const bouton = {
  base,
  principal: `${base} bg-iq-olive px-5 py-3 text-white shadow-[0_4px_0_var(--color-iq-olive-fonce)] hover:brightness-110`,
  sombre: `${base} bg-iq-foret px-4 py-3 text-white hover:brightness-125`,
  contour: `${base} border-2 border-iq-bordure bg-white px-4 py-3 text-iq-texte hover:bg-iq-champ`,
  citron: `${base} bg-iq-citron px-5 py-3 text-iq-foret shadow-[0_4px_0_#9fb866] hover:brightness-105`,
}

export const champ =
  "w-full rounded-xl border-2 border-iq-bordure bg-iq-champ px-4 py-3 text-iq-texte placeholder:text-iq-gris/60 focus:border-iq-mousse focus:outline-none disabled:opacity-60"

const COULEURS_BADGE = ["bg-iq-citron", "bg-iq-saumon", "bg-iq-ciel"]

/** Couleur stable d'un code de ressource (R5.A.10, R5.A.08...). */
export const couleurBadge = (code: string) => {
  let somme = 0

  for (let i = 0; i < code.length; i += 1) {
    somme += code.charCodeAt(i)
  }

  return COULEURS_BADGE[somme % COULEURS_BADGE.length]
}

export const initiales = (prenom: string, nom: string) =>
  `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()
