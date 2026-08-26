import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCmO6dpKJDz_i-fbbqV1vDpGaryuPhy_G4",
  authDomain: "scraping-estado-instituciones.firebaseapp.com",
  projectId: "scraping-estado-instituciones",
  storageBucket: "scraping-estado-instituciones.firebasestorage.app",
  messagingSenderId: "43540548930",
  appId: "1:43540548930:web:f78d807fcfc093adeaccdb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
