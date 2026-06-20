import prisma from '@/lib/db'

function countGroup(arr: { _count: { _all: number }; [key: string]: any }[], key: string, val: any) {
  return arr.find(group => group[key] === val)?._count._all ?? 0
}

export async function getGbpReviewData(locationId?: string | null) {
  const locations = await prisma.location.findMany({
    select: {
      id:           true,
      name:         true,
      address:      true,
      gbpConnected: true,
      lastSynced:   true,
    },
    orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
  })

  const selected = locations.find(location => location.id === locationId) ?? locations[0] ?? null

  if (!selected) {
    return {
      locations: [],
      selected: null,
      stats: {
        total_reviews: 0,
        avg_rating:    0,
        unreplied:     0,
        s5: 0,
        s4: 0,
        s3: 0,
        s2: 0,
        s1: 0,
      },
      reviews:   [],
      chartData: [],
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    aggregate,
    starGroups,
    unreplied,
    reviews,
    chartDataRaw,
  ] = await Promise.all([
    prisma.review.aggregate({
      where:  { locationId: selected.id },
      _count: { _all: true },
      _avg:   { stars: true },
    }),
    prisma.review.groupBy({
      by:     ['stars'],
      where:  { locationId: selected.id },
      _count: { _all: true },
    }),
    prisma.review.count({
      where: { locationId: selected.id, replied: false },
    }),
    prisma.review.findMany({
      where:   { locationId: selected.id },
      orderBy: [{ reviewDate: 'desc' }, { createdAt: 'desc' }],
      take:    100,
    }),
    prisma.$queryRaw<any[]>`
      SELECT DATE(review_date) AS day, COUNT(*) AS count
      FROM reviews
      WHERE location_id = ${selected.id}
        AND review_date >= ${thirtyDaysAgo}
      GROUP BY DATE(review_date)
      ORDER BY day ASC
    `,
  ])

  return {
    locations: locations.map(location => ({
      id:            location.id,
      name:          location.name,
      address:       location.address,
      gbp_connected: location.gbpConnected,
      last_synced:   location.lastSynced?.toISOString() ?? null,
    })),
    selected: {
      id:            selected.id,
      name:          selected.name,
      address:       selected.address,
      gbp_connected: selected.gbpConnected,
      last_synced:   selected.lastSynced?.toISOString() ?? null,
    },
    stats: {
      total_reviews: aggregate._count._all,
      avg_rating:    aggregate._avg.stars ?? 0,
      unreplied,
      s5:            countGroup(starGroups, 'stars', 5),
      s4:            countGroup(starGroups, 'stars', 4),
      s3:            countGroup(starGroups, 'stars', 3),
      s2:            countGroup(starGroups, 'stars', 2),
      s1:            countGroup(starGroups, 'stars', 1),
    },
    reviews: reviews.map(review => ({
      id:          review.id,
      reviewer:    review.reviewer,
      stars:       review.stars,
      review_text: review.reviewText,
      sentiment:   review.sentiment,
      replied:     review.replied,
      campaign:    review.campaign,
      review_date: review.reviewDate?.toISOString() ?? null,
      created_at:  review.createdAt.toISOString(),
    })),
    chartData: chartDataRaw.map(row => ({
      day:   row.day,
      count: Number(row.count ?? 0),
    })),
  }
}
