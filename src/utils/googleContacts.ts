import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
const contactScopes = [
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/contacts.other.readonly',
  'https://www.googleapis.com/auth/directory.readonly',
  'https://www.googleapis.com/auth/user.emails.read',
  'https://www.googleapis.com/auth/user.phonenumbers.read',
  'https://www.googleapis.com/auth/user.addresses.read',
  'https://www.googleapis.com/auth/user.birthday.read',
  'https://www.googleapis.com/auth/user.gender.read',
  'https://www.googleapis.com/auth/user.organization.read'
];

contactScopes.forEach((scope) => {
  provider.addScope(scope);
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initContactsAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleContacts = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token for Google Contacts');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Contacts Sign-In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getContactsAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutContacts = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface GoogleContact {
  resourceName: string;
  etag?: string;
  name: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
}

export async function fetchGoogleContacts(): Promise<GoogleContact[]> {
  const token = await getContactsAccessToken();
  if (!token) throw new Error('Not authenticated with Google Contacts');

  const url = 'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos&pageSize=100';
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch Google Contacts: ${errText}`);
  }

  const data = await res.json();
  const connections = data.connections || [];

  return connections.map((person: any) => {
    const nameObj = person.names?.[0];
    const emailObj = person.emailAddresses?.[0];
    const phoneObj = person.phoneNumbers?.[0];
    const photoObj = person.photos?.[0];

    return {
      resourceName: person.resourceName,
      etag: person.etag,
      name: nameObj?.displayName || 'Unnamed Contact',
      email: emailObj?.value,
      phone: phoneObj?.value,
      photoUrl: photoObj?.url,
    };
  });
}

export async function createGoogleContact(contact: { name: string; email?: string; phone?: string }): Promise<void> {
  const token = await getContactsAccessToken();
  if (!token) throw new Error('Not authenticated with Google Contacts');

  const body: any = {
    names: [{ givenName: contact.name }],
  };

  if (contact.email) {
    body.emailAddresses = [{ value: contact.email }];
  }
  if (contact.phone) {
    body.phoneNumbers = [{ value: contact.phone }];
  }

  const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create contact: ${errText}`);
  }
}
