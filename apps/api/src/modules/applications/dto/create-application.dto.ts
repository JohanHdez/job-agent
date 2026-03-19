/**
 * DTO for creating a new application draft.
 * The service will generate a Claude email draft and fetch vacancy details.
 */
export class CreateApplicationDto {
  /** MongoDB ObjectId string of the vacancy to apply to */
  vacancyId!: string;

  /**
   * Optional recipient email override.
   * If not provided, the vacancy's detected recipientEmail will be used.
   */
  recipientEmail?: string;
}
