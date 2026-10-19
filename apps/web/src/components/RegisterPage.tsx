import { AuthFormPage } from "./LoginPage";
export default function RegisterPage({ next }: { next?: string } = {}) {
  return <AuthFormPage mode="register" next={next} />;
}
