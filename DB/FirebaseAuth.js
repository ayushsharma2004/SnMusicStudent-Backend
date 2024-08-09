import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { fapp } from './firebase.js';

console.log(fapp);
const auth = getAuth();

export { auth, RecaptchaVerifier, signInWithPhoneNumber };
