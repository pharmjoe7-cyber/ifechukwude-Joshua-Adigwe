/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Camera, 
  ClipboardList, 
  LogOut, 
  Plus, 
  Search, 
  Shield, 
  User, 
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';

import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { diagnoseSymptoms, detectMalnutrition } from './services/geminiService';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// --- Types ---

interface PatientRecord {
  id: string;
  name: string;
  age: number;
  location: string;
  symptoms: string;
  diagnosis: string;
  urgency: string;
  malnutritionStatus?: string;
  timestamp: any;
  volunteerId: string;
}

interface OutbreakAlert {
  id: string;
  type: string;
  location: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: any;
}

// --- Components ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('diagnostics');
  
  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 border-bottom bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">HealthGuard AI</h1>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Rural Health Support</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
              <p className="text-xs text-slate-500">Volunteer ID: {user.uid.slice(0, 8)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex overflow-x-auto pb-2 scrollbar-hide">
            <TabsList className="bg-white p-1 shadow-sm border">
              <TabsTrigger value="diagnostics" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Activity className="h-4 w-4" />
                Diagnostics
              </TabsTrigger>
              <TabsTrigger value="malnutrition" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Camera className="h-4 w-4" />
                Malnutrition
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Zap className="h-4 w-4" />
                Alerts
              </TabsTrigger>
              <TabsTrigger value="records" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <ClipboardList className="h-4 w-4" />
                Records
              </TabsTrigger>
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="diagnostics" className="m-0">
                <DiagnosticsView userId={user.uid} />
              </TabsContent>
              <TabsContent value="malnutrition" className="m-0">
                <MalnutritionView userId={user.uid} />
              </TabsContent>
              <TabsContent value="alerts" className="m-0">
                <AlertsView />
              </TabsContent>
              <TabsContent value="records" className="m-0">
                <RecordsView userId={user.uid} />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}

// --- Sub-Views ---

function LoginView({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md space-y-8 text-center"
      >
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-2xl shadow-blue-200">
            <Shield className="h-10 w-10" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-slate-900">HealthGuard AI</h1>
          <p className="text-lg text-slate-600">Empowering Community Health Volunteers with AI Diagnostics</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle>Volunteer Access</CardTitle>
            <CardDescription>Sign in with your Ministry of Health account to access the diagnostic tools.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={onLogin} className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
              <User className="mr-2 h-5 w-5" />
              Sign in with Google
            </Button>
          </CardFooter>
        </Card>

        <p className="text-sm text-slate-400">
          Protecting rural communities through early detection and real-time monitoring.
        </p>
      </motion.div>
    </div>
  );
}

function DiagnosticsView({ userId }: { userId: string }) {
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleDiagnose = async () => {
    if (!symptoms) return;
    setIsDiagnosing(true);
    try {
      const result = await diagnoseSymptoms(symptoms);
      setDiagnosisResult(result);
    } catch (error) {
      console.error("Diagnosis error:", error);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSave = async () => {
    if (!diagnosisResult || !patientName || !age || !location) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'patients'), {
        name: patientName,
        age: parseInt(age),
        location,
        symptoms,
        diagnosis: diagnosisResult.diagnosis,
        urgency: diagnosisResult.urgency,
        timestamp: serverTimestamp(),
        volunteerId: userId
      });
      // Reset form
      setPatientName('');
      setAge('');
      setLocation('');
      setSymptoms('');
      setDiagnosisResult(null);
      alert("Record saved successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'patients');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card className="shadow-md border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-600" />
            New Patient Assessment
          </CardTitle>
          <CardDescription>Record symptoms and patient details for AI-assisted diagnosis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Patient Name</Label>
              <Input id="name" placeholder="Full Name" value={patientName} onChange={e => setPatientName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" placeholder="Years" value={age} onChange={e => setAge(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Village / District</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input id="location" className="pl-10" placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="symptoms">Symptoms</Label>
            <Textarea 
              id="symptoms" 
              placeholder="Describe symptoms (e.g., high fever, chills, cough, rapid breathing...)" 
              className="min-h-[120px]"
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700" 
            disabled={isDiagnosing || !symptoms}
            onClick={handleDiagnose}
          >
            {isDiagnosing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Run AI Diagnostic
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-6">
        {diagnosisResult ? (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-l-4 border-l-blue-600 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-blue-700">AI Assessment</CardTitle>
                  <Badge variant={diagnosisResult.urgency === 'critical' || diagnosisResult.urgency === 'high' ? 'destructive' : 'secondary'}>
                    {diagnosisResult.urgency.toUpperCase()} URGENCY
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Potential Diagnosis</h4>
                  <p className="text-xl font-bold text-slate-900">{diagnosisResult.diagnosis}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Explanation</h4>
                  <p className="text-slate-600 leading-relaxed">{diagnosisResult.explanation}</p>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Recommended Actions</h4>
                  <ul className="space-y-2">
                    {diagnosisResult.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-slate-700">
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50/50 border-t">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleSave}
                  disabled={isSaving || !patientName || !age || !location}
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                  Save to Patient Records
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
            <Activity className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-lg font-medium">No diagnostic run yet</p>
            <p className="text-sm">Enter symptoms on the left to get an AI assessment.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MalnutritionView({ userId }: { userId: string }) {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setShowCamera(true);
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setImage(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    try {
      const base64 = image.split(',')[1];
      const result = await detectMalnutrition(base64);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card className="shadow-md border-none overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Malnutrition Detection
          </CardTitle>
          <CardDescription>Use computer vision to detect signs of malnutrition in children.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 flex items-center justify-center">
            {showCamera ? (
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
            ) : image ? (
              <img src={image} alt="Captured" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-center text-slate-500">
                <Camera className="mx-auto mb-2 h-12 w-12 opacity-20" />
                <p>Camera Preview</p>
              </div>
            )}
            
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex gap-4">
            {!showCamera ? (
              <Button onClick={startCamera} className="flex-1 bg-slate-800 hover:bg-slate-900">
                <Camera className="mr-2 h-4 w-4" />
                {image ? 'Retake Photo' : 'Open Camera'}
              </Button>
            ) : (
              <Button onClick={captureImage} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Capture Photo
              </Button>
            )}
            {showCamera && (
              <Button variant="outline" onClick={stopCamera}>Cancel</Button>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700" 
            disabled={isAnalyzing || !image}
            onClick={handleAnalyze}
          >
            {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Analyze for Malnutrition
          </Button>
        </CardFooter>
      </Card>

      <div className="space-y-6">
        {analysisResult ? (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-l-4 border-l-blue-600 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-blue-700">Vision Analysis</CardTitle>
                  <Badge 
                    variant={
                      analysisResult.status === 'Severe Acute Malnutrition' ? 'destructive' : 
                      analysisResult.status === 'Moderate Acute Malnutrition' ? 'outline' : 'secondary'
                    }
                    className={analysisResult.status === 'Moderate Acute Malnutrition' ? 'border-orange-500 text-orange-600' : ''}
                  >
                    {analysisResult.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Observations</h4>
                  <ul className="space-y-2">
                    {analysisResult.observations.map((obs: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-slate-700">
                        <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Recommended Actions</h4>
                  <ul className="space-y-2">
                    {analysisResult.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-slate-700">
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
            <Camera className="mb-4 h-12 w-12 opacity-20" />
            <p className="text-lg font-medium">No analysis performed</p>
            <p className="text-sm">Capture a photo of the patient to detect signs of malnutrition.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertsView() {
  const [alerts, setAlerts] = useState<OutbreakAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alertsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OutbreakAlert[];
      setAlerts(alertsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'alerts');
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Real-Time Outbreak Alerts</h2>
          <p className="text-slate-500">Monitoring disease patterns across districts.</p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          Live Monitoring Active
        </Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : alerts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {alerts.map((alert) => (
            <motion.div key={alert.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className={`border-l-4 ${
                alert.severity === 'critical' ? 'border-l-red-600' : 
                alert.severity === 'high' ? 'border-l-orange-500' : 'border-l-blue-400'
              } shadow-sm`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {alert.timestamp?.toDate().toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{alert.type} Outbreak</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {alert.location}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{alert.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
          <Shield className="mb-4 h-12 w-12 opacity-20 text-green-500" />
          <p className="text-lg font-medium text-slate-600">No active outbreaks detected</p>
          <p className="text-sm">The community is currently stable. Stay vigilant.</p>
        </div>
      )}

      <Alert className="bg-blue-50 border-blue-200">
        <Zap className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 font-bold">Protocol Reminder</AlertTitle>
        <AlertDescription className="text-blue-700">
          If you detect more than 3 cases of the same symptoms in one village within 48 hours, report it immediately as a potential outbreak.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function RecordsView({ userId }: { userId: string }) {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PatientRecord[];
      setRecords(recordsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'patients');
    });
    return () => unsubscribe();
  }, []);

  const filteredRecords = records.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Patient Records</h2>
          <p className="text-slate-500">History of assessments and diagnoses.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search patients..." 
            className="pl-10" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredRecords.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Diagnosis</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Urgency</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{record.name}</div>
                    <div className="text-xs text-slate-500">{record.age} years</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-700">{record.diagnosis}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {record.location}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {record.timestamp?.toDate().toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={record.urgency === 'critical' || record.urgency === 'high' ? 'destructive' : 'secondary'}>
                      {record.urgency}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">View Details</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Patient Assessment Details</DialogTitle>
                          <DialogDescription>Recorded on {record.timestamp?.toDate().toLocaleString()}</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Patient</h4>
                              <p className="font-bold">{record.name}, {record.age}y</p>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Location</h4>
                              <p className="font-bold">{record.location}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Symptoms Reported</h4>
                            <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border italic">"{record.symptoms}"</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">AI Diagnosis</h4>
                            <p className="text-lg font-bold text-blue-700">{record.diagnosis}</p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
          <ClipboardList className="mb-4 h-12 w-12 opacity-20" />
          <p className="text-lg font-medium">No records found</p>
          <p className="text-sm">Start by running a diagnostic assessment.</p>
        </div>
      )}
    </div>
  );
}
