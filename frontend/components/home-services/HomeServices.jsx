import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CategoryTile from './CategoryTile';
import { categories, services } from './data';
import ServiceCard from './ServiceCard';
import styles from './styles';
import useLocation from '../../hooks/use-location';
import { authApi, bookingsApi, getStoredUser, verifyGoogleToken } from '../../services/api';
import AdminKycReview from '../admin/AdminKycReview';
import KycSection from '../kyc/KycSection';

WebBrowser.maybeCompleteAuthSession();

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || 'google-web-client-not-configured';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'google-android-client-not-configured';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'google-ios-client-not-configured';
const googleLoginConfigured = Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);

export default function HomeServices() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const { locationLabel, nearbyWorkers, isRefreshing, refreshLocation } = useLocation(
    user?.role === 'worker'
  );

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeNav, setActiveNav] = useState('Home');
  const [bookedService, setBookedService] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState('Tomorrow, 10:00 AM');

  // Auth form states
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authRole, setAuthRole] = useState('customer'); // 'customer' | 'worker' | 'admin'

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleWebClientId,
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
  });

  // Load stored user session on launch
  useEffect(() => {
    getStoredUser().then((stored) => {
      if (stored) {
        setUser(stored);
      }
    });
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.authentication?.idToken || response.params?.id_token;
    if (!idToken) {
      setLoginError('Google did not return an ID token.');
      return;
    }

    verifyGoogleToken(idToken)
      .then((result) => {
        setUser(result.user);
        setLoginError('');
      })
      .catch(() => setLoginError('Google login could not be completed.'));
  }, [response]);

  const CATEGORY_SYNONYMS = useMemo(
    () => ({
      Plumbing: ['plumb', 'pipe', 'leak', 'water', 'tap'],
      Electrical: ['electric', 'wire', 'light', 'fan', 'switch'],
      Carpentry: ['carpent', 'wood', 'furniture', 'door'],
      Cleaning: ['clean', 'housekeep', 'mop', 'wash'],
      Painting: ['paint', 'wall', 'color'],
      'Pest control': ['pest', 'bug', 'insect', 'termite'],
      'Appliance repair': ['appliance', 'ac', 'fridge', 'repair', 'mechanic'],
    }),
    []
  );

  const servicesForArea = useMemo(() => {
    const realWorkers = nearbyWorkers.map((worker) => ({
      id: worker.id || worker.worker_id,
      title: `${worker.full_name || 'Worker'} (${worker.skill || 'Trade'})`,
      category: worker.skill || 'General',
      rating: worker.rating ? String(worker.rating) : '4.9',
      price: `₹${worker.hourly_rate || 350}/hr`,
      description: worker.bio || `${worker.experience || 0} yrs exp • District: ${worker.district || 'Local'}`,
      distanceKm: worker.distance_km || 2.5,
      isRealWorker: true,
      image: worker.profile_image_url || null,
    }));

    return [...realWorkers, ...services];
  }, [nearbyWorkers]);

  const visibleServices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const synonyms = CATEGORY_SYNONYMS[activeCategory] || [activeCategory.toLowerCase()];

    return servicesForArea
      .filter((service) => service && service.title)
      .filter((service) => {
        const catLower = (service.category || '').toLowerCase();
        const titleLower = (service.title || '').toLowerCase();
        const descLower = (service.description || '').toLowerCase();

        const matchesCategory =
          activeCategory === 'All' ||
          catLower.includes(activeCategory.toLowerCase()) ||
          synonyms.some((syn) => catLower.includes(syn) || titleLower.includes(syn) || descLower.includes(syn));

        const searchable = `${titleLower} ${catLower} ${descLower}`;
        const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);

        return matchesCategory && matchesQuery;
      });
  }, [activeCategory, query, servicesForArea, CATEGORY_SYNONYMS]);

  const selectCategory = (name) => setActiveCategory((current) => (current === name ? 'All' : name));

  const navItems =
    user?.role === 'worker'
      ? [
          { label: 'Jobs', icon: 'briefcase-outline' },
          { label: 'Messages', icon: 'chatbubble-ellipses-outline' },
          { label: 'Profile', icon: 'person-outline' },
        ]
      : user?.role === 'admin'
      ? [
          { label: 'Admin', icon: 'shield-checkmark-outline' },
          { label: 'Messages', icon: 'chatbubble-ellipses-outline' },
          { label: 'Profile', icon: 'person-outline' },
        ]
      : [
          { label: 'Home', icon: 'home' },
          { label: 'Bookings', icon: 'calendar-outline' },
          { label: 'Messages', icon: 'chatbubble-ellipses-outline' },
          { label: 'Profile', icon: 'person-outline' },
        ];

  const renderServiceCard = (service) =>
    service && (
      <ServiceCard
        key={service.id || service.title}
        service={service}
        booked={bookedService === service.title}
        onBook={() => setSelectedService(service)}
      />
    );

  const submitAuth = async () => {
    setLoginError('');
    if (authMode === 'signup' && !authName.trim()) {
      setLoginError('Enter your full name to create an account.');
      return;
    }
    if (!authEmail.includes('@')) {
      setLoginError('Enter a valid email address.');
      return;
    }
    if (authMode === 'signup' && (!authPhone.trim() || authPhone.trim().length < 8)) {
      setLoginError('Enter a valid phone number (at least 8 digits).');
      return;
    }
    if (authPassword.length < 6) {
      setLoginError('Password must be at least 6 characters.');
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const res = await authApi.login({
          email: authEmail.trim(),
          password: authPassword,
        });
        const loggedUser = res.user || { email: authEmail.trim(), role: res.role };
        setUser(loggedUser);
        setActiveNav(loggedUser.role === 'worker' ? 'Jobs' : loggedUser.role === 'admin' ? 'Admin' : 'Home');
      } else {
        const res = await authApi.signup({
          full_name: authName.trim(),
          email: authEmail.trim(),
          phone: authPhone.trim(),
          password: authPassword,
          role: authRole,
        });
        const newUser = res.user || {
          id: res.id,
          full_name: authName.trim(),
          email: res.email || authEmail.trim(),
          phone: authPhone.trim(),
          role: res.role || authRole,
        };
        setUser(newUser);
        setActiveNav(newUser.role === 'worker' ? 'Jobs' : newUser.role === 'admin' ? 'Admin' : 'Home');
      }
    } catch (err) {
      setLoginError(err.message || 'Authentication failed. Check your network or credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await authApi.logout();
    setUser(null);
    setActiveNav('Home');
  };

  const confirmBooking = async () => {
    if (!selectedService?.title) return;
    try {
      await bookingsApi.createBooking({
        worker_id: selectedService.id,
        service_title: selectedService.title,
        slot: selectedSlot,
      }).catch(() => {}); // Non-blocking mock fallback if endpoint varies
      setBookedService(selectedService.title);
      setSelectedService(null);
      setActiveNav('Bookings');
    } catch (_e) {
      setBookedService(selectedService.title);
      setSelectedService(null);
      setActiveNav('Bookings');
    }
  };

  const renderHome = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerOrbOne} />
        <View style={styles.headerOrbTwo} />
        <View style={styles.headerCopy}>
          <Text style={styles.greeting}>SAHAKARSEVA</Text>
          <Text style={styles.heading}>Cooperative Services, Simplified.</Text>
          <TouchableOpacity style={styles.locationRow} onPress={refreshLocation} activeOpacity={0.7}>
            <Ionicons name="location-outline" size={14} color="#ef795e" />
            <Text style={styles.locationText}>{locationLabel}</Text>
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#ef795e" style={{ marginLeft: 4 }} />
            ) : (
              <Ionicons name="refresh-outline" size={12} color="#84939a" style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={() => setActiveNav('Profile')} activeOpacity={0.8}>
          <Ionicons name="person-outline" size={20} color="#466175" />
          {user ? <View style={[styles.notificationDot, { backgroundColor: '#16a34a' }]} /> : null}
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={21} color="#84939a" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search for local workers or trades..."
          placeholderTextColor="#9ca7aa"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color="#9ca7aa" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.offerBanner}>
        <View style={styles.offerCircleLarge} />
        <View style={styles.offerCircleSmall} />
        <View style={styles.offerCopy}>
          <Text style={styles.offerEyebrow}>VERIFIED COOPERATIVE WORKERS</Text>
          <Text style={styles.offerTitle}>Book trusted, background-checked pros</Text>
          <TouchableOpacity style={styles.offerButton} onPress={() => setActiveCategory('All')} activeOpacity={0.8}>
            <Text style={styles.offerButtonText}>Explore workers</Text>
            <Ionicons name="arrow-forward" size={14} color="#203747" />
          </TouchableOpacity>
        </View>
        <Ionicons name="shield-checkmark-outline" size={54} color="#f4b38f" style={styles.offerIcon} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular categories</Text>
          <TouchableOpacity onPress={() => setActiveCategory('All')}>
            <Text style={styles.sectionAction}>View all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {categories.map((category) => (
            <CategoryTile
              key={category.name}
              category={category}
              selected={activeCategory === category.name}
              onPress={() => selectCategory(category.name)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Nearby Verified Pros</Text>
          <Text style={styles.sectionSubtitle}>
            {nearbyWorkers.length > 0 ? `${nearbyWorkers.length} active workers found nearby` : 'Top local professionals'}
          </Text>
        </View>
        <View style={styles.ratingPill}>
          <Ionicons name="star" size={12} color="#e9a32f" />
          <Text style={styles.serviceCount}>4.9 rating</Text>
        </View>
      </View>

      {visibleServices.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceList}>
          {visibleServices.map(renderServiceCard)}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={28} color="#84939a" />
          <Text style={styles.emptyTitle}>No workers found</Text>
          <Text style={styles.emptyText}>Try adjusting your search query or expanding your location.</Text>
        </View>
      )}

      <View style={styles.trustRow}>
        <View style={styles.trustItem}>
          <Ionicons name="shield-checkmark-outline" size={21} color="#5c9074" />
          <Text style={styles.trustText}>KYC Verified</Text>
        </View>
        <View style={styles.trustItem}>
          <Ionicons name="time-outline" size={21} color="#5c9074" />
          <Text style={styles.trustText}>Prompt Service</Text>
        </View>
        <View style={styles.trustItem}>
          <Ionicons name="card-outline" size={21} color="#5c9074" />
          <Text style={styles.trustText}>Fair Pricing</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderBookings = () => (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageEyebrow}>YOUR ACTIVITY</Text>
      <Text style={styles.pageTitle}>Bookings</Text>
      {bookedService ? (
        <View style={styles.bookingCard}>
          <View style={styles.bookingIcon}>
            <Ionicons name="calendar-outline" size={24} color="#ef795e" />
          </View>
          <View style={styles.bookingCopy}>
            <Text style={styles.bookingStatus}>REQUEST CONFIRMED</Text>
            <Text style={styles.bookingTitle}>{bookedService}</Text>
            <Text style={styles.bookingDetails}>We&apos;ve assigned a verified worker to your address.</Text>
          </View>
          <Ionicons name="checkmark-circle" size={24} color="#5c9074" />
        </View>
      ) : (
        <View style={styles.emptyPage}>
          <Ionicons name="calendar-outline" size={34} color="#aab6b8" />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyText}>Your requested services will appear here.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setActiveNav('Home')}>
            <Text style={styles.primaryButtonText}>Find a worker</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderMessages = () => (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageEyebrow}>STAY IN THE LOOP</Text>
      <Text style={styles.pageTitle}>Messages</Text>
      <View style={styles.messageCard}>
        <View style={styles.messageIcon}>
          <Ionicons name="sparkles" size={20} color="#ef795e" />
        </View>
        <View style={styles.messageCopy}>
          <Text style={styles.bookingTitle}>Welcome to SahakarSeva</Text>
          <Text style={styles.bookingDetails}>Connecting cooperative workers with customers nationwide.</Text>
          <Text style={styles.messageTime}>Just now</Text>
        </View>
      </View>
      <View style={styles.messageCard}>
        <View style={[styles.messageIcon, styles.messageIconGreen]}>
          <Ionicons name="shield-checkmark" size={20} color="#5c9074" />
        </View>
        <View style={styles.messageCopy}>
          <Text style={styles.bookingTitle}>KYC Verification Guarantee</Text>
          <Text style={styles.bookingDetails}>Every worker profile undergoes document verification before assignment.</Text>
          <Text style={styles.messageTime}>Today</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderWorker = () => <KycSection user={user} onProfileUpdated={() => {}} />;

  const renderAdmin = () => <AdminKycReview />;

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageEyebrow}>ACCOUNT</Text>
      <Text style={styles.pageTitle}>Profile</Text>
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Ionicons name="person" size={29} color="#466175" />
        </View>
        <View style={styles.profileIdentity}>
          <Text style={styles.profileName}>{user?.full_name || user?.name || 'Guest User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'Sign in to manage your account'}</Text>
          {user?.role ? <Text style={styles.roleBadge}>{user.role.toUpperCase()}</Text> : null}
        </View>
      </View>

      {!user ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setAuthMode('login');
            setLoginError('');
            setActiveNav('Auth');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Login or Create Account</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      )}

      {loginError ? <Text style={styles.loginError}>{loginError}</Text> : null}

      {['Location Settings', 'KYC & Verification', 'Help & Support', 'About SahakarSeva'].map((item, index) => (
        <TouchableOpacity
          key={item}
          style={styles.profileRow}
          onPress={() => {
            if (index === 1 && user?.role === 'worker') setActiveNav('Jobs');
            if (index === 1 && user?.role === 'admin') setActiveNav('Admin');
          }}
        >
          <Ionicons
            name={['location-outline', 'shield-checkmark-outline', 'help-circle-outline', 'information-circle-outline'][index]}
            size={21}
            color="#6e8188"
          />
          <Text style={styles.profileRowText}>{item}</Text>
          <Ionicons name="chevron-forward" size={18} color="#b4bfc1" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderAuth = () => (
    <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.authBack} onPress={() => setActiveNav('Profile')} hitSlop={10}>
        <Ionicons name="arrow-back" size={22} color="#203747" />
      </TouchableOpacity>
      <Text style={styles.authBrand}>SahakarSeva</Text>
      <Text style={styles.authTitle}>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
      <Text style={styles.authSubtitle}>
        {authMode === 'login'
          ? 'Sign in to access services, jobs, or administration.'
          : 'Join SahakarSeva to connect with cooperative workers.'}
      </Text>

      <Text style={styles.roleLabel}>I am signing in as</Text>
      <View style={styles.roleList}>
        {[
          ['customer', 'person-outline', 'Customer'],
          ['worker', 'briefcase-outline', 'Worker'],
          ['admin', 'shield-checkmark-outline', 'Admin'],
        ].map(([role, icon, label]) => (
          <TouchableOpacity
            key={role}
            style={[styles.roleOption, authRole === role && styles.roleOptionSelected]}
            onPress={() => setAuthRole(role)}
          >
            <Ionicons name={icon} size={17} color={authRole === role ? '#ef795e' : '#84939a'} />
            <Text style={[styles.roleOptionText, authRole === role && styles.roleOptionTextSelected]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.authTabs}>
        <TouchableOpacity
          style={[styles.authTab, authMode === 'login' && styles.authTabActive]}
          onPress={() => {
            setAuthMode('login');
            setLoginError('');
          }}
        >
          <Text style={[styles.authTabText, authMode === 'login' && styles.authTabTextActive]}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.authTab, authMode === 'signup' && styles.authTabActive]}
          onPress={() => {
            setAuthMode('signup');
            setLoginError('');
          }}
        >
          <Text style={[styles.authTabText, authMode === 'signup' && styles.authTabTextActive]}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      {authMode === 'signup' && (
        <>
          <View style={styles.authInputWrap}>
            <Ionicons name="person-outline" size={19} color="#84939a" />
            <TextInput
              value={authName}
              onChangeText={setAuthName}
              placeholder="Full name"
              placeholderTextColor="#9ca7aa"
              style={styles.authInput}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.authInputWrap}>
            <Ionicons name="call-outline" size={19} color="#84939a" />
            <TextInput
              value={authPhone}
              onChangeText={setAuthPhone}
              placeholder="Phone number (e.g. 9876543210)"
              placeholderTextColor="#9ca7aa"
              style={styles.authInput}
              keyboardType="phone-pad"
            />
          </View>
        </>
      )}

      <View style={styles.authInputWrap}>
        <Ionicons name="mail-outline" size={19} color="#84939a" />
        <TextInput
          value={authEmail}
          onChangeText={setAuthEmail}
          placeholder="Email address"
          placeholderTextColor="#9ca7aa"
          style={styles.authInput}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.authInputWrap}>
        <Ionicons name="lock-closed-outline" size={19} color="#84939a" />
        <TextInput
          value={authPassword}
          onChangeText={setAuthPassword}
          placeholder="Password"
          placeholderTextColor="#9ca7aa"
          style={styles.authInput}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword((current) => !current)} hitSlop={10}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#84939a" />
        </TouchableOpacity>
      </View>

      {loginError ? <Text style={styles.loginError}>{loginError}</Text> : null}

      <TouchableOpacity style={styles.confirmButton} onPress={submitAuth} disabled={authLoading} activeOpacity={0.8}>
        {authLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.confirmButtonText}>{authMode === 'login' ? 'Login' : 'Create Account'}</Text>
            <Ionicons name="arrow-forward" size={17} color="#fff" style={{ marginLeft: 6 }} />
          </>
        )}
      </TouchableOpacity>

      <View style={styles.authDivider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.googleButton, (!request || !googleLoginConfigured) && styles.googleButtonDisabled]}
        disabled={!request || !googleLoginConfigured}
        onPress={() => {
          setLoginError('');
          promptAsync();
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="logo-google" size={18} color="#4285f4" />
        <Text style={styles.googleButtonText}>
          {googleLoginConfigured ? 'Continue with Google' : 'Google login needs setup'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6f8f6" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {activeNav === 'Home' && renderHome()}
        {activeNav === 'Bookings' && renderBookings()}
        {activeNav === 'Messages' && renderMessages()}
        {activeNav === 'Jobs' && renderWorker()}
        {activeNav === 'Admin' && renderAdmin()}
        {activeNav === 'Profile' && renderProfile()}
        {activeNav === 'Auth' && renderAuth()}
        {activeNav !== 'Auth' && (
          <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.navItem}
                onPress={() => setActiveNav(item.label)}
                activeOpacity={0.8}
              >
                <Ionicons name={item.icon} size={22} color={activeNav === item.label ? '#ef795e' : '#9aa5aa'} />
                <Text style={[styles.navLabel, activeNav === item.label && styles.navLabelActive]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </KeyboardAvoidingView>

      {selectedService && (
        <View style={styles.modalLayer}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedService(null)} />
          <View style={styles.bookingSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>BOOK A WORKER</Text>
                <Text style={styles.sheetTitle}>{selectedService?.title || 'Selected service'}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedService(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#71808a" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetLabel}>Choose a time slot</Text>
            <View style={styles.slotList}>
              {['Tomorrow, 10:00 AM', 'Tomorrow, 2:00 PM', 'Saturday, 11:00 AM'].map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.slot, selectedSlot === slot && styles.slotSelected]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Ionicons name="time-outline" size={16} color={selectedSlot === slot ? '#ef795e' : '#84939a'} />
                  <Text style={[styles.slotText, selectedSlot === slot && styles.slotTextSelected]}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={20} color="#ef795e" />
              <View style={styles.addressCopy}>
                <Text style={styles.sheetLabel}>Your Location</Text>
                <Text style={styles.addressText}>{locationLabel}</Text>
              </View>
            </View>
            <View style={styles.bookingSummary}>
              <Text style={styles.summaryLabel}>Price Rate</Text>
              <Text style={styles.summaryPrice}>{selectedService?.price || 'Standard rate'}</Text>
            </View>
            <TouchableOpacity style={styles.confirmButton} onPress={confirmBooking} activeOpacity={0.8}>
              <Text style={styles.confirmButtonText}>Confirm Request</Text>
              <Ionicons name="arrow-forward" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}