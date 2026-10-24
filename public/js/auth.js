import {
  changerIdentifiant,
  changerMotDePasse,
  majProfil,
  signInCaregiver,
  signInPatient,
  signOut,
  signUpCaregiver,
  utilisateurCourant,
} from "./store.js";

export function session() {
  return utilisateurCourant();
}

export function profil() {
  return utilisateurCourant();
}

export const signIn = signInCaregiver;
export const signUp = signUpCaregiver;
export { signOut, signInPatient, changerMotDePasse, changerIdentifiant, majProfil };
