export interface CommunityPulseItem {
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
  likeCount: number;
  reviewCount: number;
  savedCount: number;
}

export interface CommunityPulseData {
  mostLiked: CommunityPulseItem[];
  mostReviewed: CommunityPulseItem[];
  mostSaved: CommunityPulseItem[];
}
