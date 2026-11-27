import { AuthPanel } from "../components/AuthPanel";
import { TestRetailerLogin } from "../components/TestRetailerLogin";
export default function LoginScreen() { return __DEV__ ? <TestRetailerLogin/> : <AuthPanel mode="login"/>; }
