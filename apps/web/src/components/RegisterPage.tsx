import { AuthFormPage } from "./LoginPage";
export default function RegisterPage({ next, onEnterGuest }: { next?: string; onEnterGuest?: () => void } = {}) {
  return <AuthFormPage mode="register" next={next} onEnterGuest={onEnterGuest} />;
}
