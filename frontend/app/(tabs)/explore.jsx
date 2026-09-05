import { StyleSheet, Text, View } from 'react-native';

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore services</Text>
      <Text style={styles.subtitle}>Discover trusted professionals for your home.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#f6f8f6' },
  title: { color: '#203747', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#71808a', fontSize: 14, marginTop: 8, textAlign: 'center' },
});