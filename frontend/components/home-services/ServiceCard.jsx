import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Text, TouchableOpacity, View } from 'react-native';

import styles from './styles';

export default function ServiceCard({ service, booked, onBook }) {
  if (!service?.title) return null;

  return (
    <View style={styles.serviceCard}>
      <Image source={service.image} style={styles.serviceImage} contentFit="cover" transition={250} />
      <View style={styles.serviceContent}>
        <View style={styles.serviceMeta}>
          <Text style={styles.servicePrice}>{service.price}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={13} color="#f1ad3e" />
            <Text style={styles.ratingText}>{service.rating}</Text>
          </View>
        </View>
        <Text style={styles.serviceTitle} numberOfLines={2}>{service.title}</Text>
        <Text style={styles.serviceDescription} numberOfLines={2}>{service.description}</Text>
        <TouchableOpacity style={[styles.bookButton, booked && styles.bookButtonBooked]} onPress={onBook} activeOpacity={0.8}>
          <Text style={styles.bookButtonText}>{booked ? 'Requested' : 'Book now'}</Text>
          <Ionicons name={booked ? 'checkmark' : 'arrow-forward'} size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}